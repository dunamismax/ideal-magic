"use client";

import {
  CheckCircle2,
  CircleAlert,
  LoaderCircle,
  Save,
  Send,
  XCircle,
} from "lucide-react";
import { type FormEvent, useEffect, useState } from "react";

import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { FormField, fieldControlClassName } from "@/components/ui/form-field";
import type { PublicEventInviteView } from "@/features/events/public-event-view";
import { PublicEventInvite } from "./public-event-invite";

type PublicEventInviteResponse = {
  event: PublicEventInviteView;
};

type GuestRsvpReceipt = {
  rsvpToken: string;
  guestName: string;
  status: GuestRsvpStatus;
};

type GuestRsvpStatus = "yes" | "maybe" | "no" | "waitlist";

type GuestRsvpFieldErrors = Partial<{
  guestName: string;
  status: string;
}>;

type GuestRsvpResponse = Partial<PublicEventInviteResponse> & {
  guestRsvp?: GuestRsvpReceipt;
  error?: string;
  fieldErrors?: GuestRsvpFieldErrors;
};

export function PublicEventInviteClient({
  inviteToken,
}: {
  inviteToken: string;
}) {
  const [event, setEvent] = useState<PublicEventInviteView | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "missing">(
    "loading",
  );
  const [guestName, setGuestName] = useState("");
  const [rsvpStatus, setRsvpStatus] = useState<GuestRsvpStatus>("yes");
  const [guestRsvp, setGuestRsvp] = useState<GuestRsvpReceipt | null>(null);
  const [submitStatus, setSubmitStatus] = useState<
    "idle" | "saving" | "saved" | "cancelled" | "error"
  >("idle");
  const [fieldErrors, setFieldErrors] = useState<GuestRsvpFieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function loadEvent() {
      setStatus("loading");

      try {
        const response = await fetch(
          `/api/public-events/${encodeURIComponent(inviteToken)}`,
          {
            headers: {
              accept: "application/json",
            },
          },
        );

        if (!response.ok) {
          throw new Error("Invite not available");
        }

        const payload = (await response.json()) as PublicEventInviteResponse;

        if (active) {
          setEvent(payload.event);
          setStatus("ready");
        }

        const storedRsvpToken = readStoredGuestRsvpToken(inviteToken);

        if (!storedRsvpToken) {
          return;
        }

        const rsvpResponse = await fetch(
          `/api/public-events/${encodeURIComponent(inviteToken)}/guest-rsvp/${encodeURIComponent(storedRsvpToken)}`,
          {
            headers: {
              accept: "application/json",
            },
          },
        );

        if (!rsvpResponse.ok) {
          clearStoredGuestRsvpToken(inviteToken);
          return;
        }

        const rsvpPayload = (await rsvpResponse.json()) as GuestRsvpResponse;

        if (active && rsvpPayload.event && rsvpPayload.guestRsvp) {
          setEvent(rsvpPayload.event);
          setGuestRsvp(rsvpPayload.guestRsvp);
          setGuestName(rsvpPayload.guestRsvp.guestName);
          setRsvpStatus(rsvpPayload.guestRsvp.status);
        }
      } catch {
        if (active) {
          setEvent(null);
          setStatus("missing");
        }
      }
    }

    void loadEvent();

    return () => {
      active = false;
    };
  }, [inviteToken]);

  async function submitGuestRsvp(formEvent: FormEvent<HTMLFormElement>) {
    formEvent.preventDefault();
    setSubmitStatus("saving");
    setFieldErrors({});
    setFormError(null);

    try {
      const response = await fetch(
        guestRsvp
          ? `/api/public-events/${encodeURIComponent(inviteToken)}/guest-rsvp/${encodeURIComponent(guestRsvp.rsvpToken)}`
          : `/api/public-events/${encodeURIComponent(inviteToken)}/guest-rsvp`,
        {
          method: guestRsvp ? "PATCH" : "POST",
          headers: {
            accept: "application/json",
            "content-type": "application/json",
          },
          body: JSON.stringify({
            guestName,
            status: rsvpStatus,
          }),
        },
      );
      const payload = (await response.json()) as GuestRsvpResponse;

      if (!response.ok || !payload.event || !payload.guestRsvp) {
        setFieldErrors(payload.fieldErrors ?? {});
        setFormError(payload.error ?? "Guest RSVP could not be saved.");
        setSubmitStatus("error");
        return;
      }

      setEvent(payload.event);
      setGuestRsvp(payload.guestRsvp);
      setGuestName(payload.guestRsvp.guestName);
      setRsvpStatus(payload.guestRsvp.status);
      storeGuestRsvpToken(inviteToken, payload.guestRsvp.rsvpToken);
      setSubmitStatus("saved");
    } catch {
      setFormError("Guest RSVP could not be saved.");
      setSubmitStatus("error");
    }
  }

  async function cancelGuestRsvp() {
    if (!guestRsvp) {
      return;
    }

    setSubmitStatus("saving");
    setFieldErrors({});
    setFormError(null);

    try {
      const response = await fetch(
        `/api/public-events/${encodeURIComponent(inviteToken)}/guest-rsvp/${encodeURIComponent(guestRsvp.rsvpToken)}`,
        {
          method: "DELETE",
          headers: {
            accept: "application/json",
          },
        },
      );
      const payload = (await response.json()) as GuestRsvpResponse;

      if (!response.ok || !payload.event || !payload.guestRsvp) {
        setFormError(payload.error ?? "Guest RSVP could not be cancelled.");
        setSubmitStatus("error");
        return;
      }

      setEvent(payload.event);
      setGuestRsvp(payload.guestRsvp);
      setGuestName(payload.guestRsvp.guestName);
      setRsvpStatus(payload.guestRsvp.status);
      storeGuestRsvpToken(inviteToken, payload.guestRsvp.rsvpToken);
      setSubmitStatus("cancelled");
    } catch {
      setFormError("Guest RSVP could not be cancelled.");
      setSubmitStatus("error");
    }
  }

  if (status === "loading") {
    return (
      <div className="rounded-panel border border-border bg-surface p-4 shadow-sm">
        <div className="flex items-center gap-3 text-sm font-bold text-muted">
          <LoaderCircle className="size-5 animate-spin" aria-hidden="true" />
          Loading invite
        </div>
      </div>
    );
  }

  if (!event) {
    return (
      <EmptyState
        icon={CircleAlert}
        title="Event invite unavailable"
        description="The invite may be expired, mistyped, or not public-safe."
      />
    );
  }

  return (
    <PublicEventInvite
      event={event}
      guestRsvpForm={
        <GuestRsvpForm
          fieldErrors={fieldErrors}
          formError={formError}
          guestName={guestName}
          hasExistingRsvp={guestRsvp !== null}
          onCancel={cancelGuestRsvp}
          onGuestNameChange={setGuestName}
          onSubmit={submitGuestRsvp}
          onStatusChange={setRsvpStatus}
          rsvpStatus={rsvpStatus}
          submitStatus={submitStatus}
        />
      }
    />
  );
}

function GuestRsvpForm({
  fieldErrors,
  formError,
  guestName,
  hasExistingRsvp,
  onCancel,
  onGuestNameChange,
  onStatusChange,
  onSubmit,
  rsvpStatus,
  submitStatus,
}: {
  fieldErrors: GuestRsvpFieldErrors;
  formError: string | null;
  guestName: string;
  hasExistingRsvp: boolean;
  onCancel: () => void;
  onGuestNameChange: (name: string) => void;
  onStatusChange: (status: GuestRsvpStatus) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  rsvpStatus: GuestRsvpStatus;
  submitStatus: "idle" | "saving" | "saved" | "cancelled" | "error";
}) {
  return (
    <form
      className="rounded-panel border border-border bg-surface p-4 shadow-sm"
      onSubmit={onSubmit}
    >
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold">
            {hasExistingRsvp ? "Your RSVP" : "Guest RSVP"}
          </h2>
        </div>
        {submitStatus === "saved" ? (
          <span className="inline-flex items-center gap-1.5 text-xs font-bold text-accent">
            <CheckCircle2 className="size-4" aria-hidden="true" />
            Saved
          </span>
        ) : null}
        {submitStatus === "cancelled" ? (
          <span className="inline-flex items-center gap-1.5 text-xs font-bold text-danger">
            <XCircle className="size-4" aria-hidden="true" />
            Cancelled
          </span>
        ) : null}
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_10rem_auto] sm:items-start">
        <FormField label="Name" error={fieldErrors.guestName}>
          <input
            className={fieldControlClassName}
            maxLength={80}
            onChange={(event) => onGuestNameChange(event.target.value)}
            placeholder="Guest name"
            value={guestName}
          />
        </FormField>

        <FormField label="Status" error={fieldErrors.status}>
          <select
            className={fieldControlClassName}
            onChange={(event) =>
              onStatusChange(event.target.value as GuestRsvpStatus)
            }
            value={rsvpStatus}
          >
            <option value="yes">Yes</option>
            <option value="maybe">Maybe</option>
            <option value="no">No</option>
            <option value="waitlist">Waitlist</option>
          </select>
        </FormField>

        <Button
          className="mt-0 sm:mt-6"
          disabled={submitStatus === "saving"}
          type="submit"
          variant="primary"
        >
          {submitStatus === "saving" ? (
            <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
          ) : hasExistingRsvp ? (
            <Save className="size-4" aria-hidden="true" />
          ) : (
            <Send className="size-4" aria-hidden="true" />
          )}
          {hasExistingRsvp ? "Save RSVP" : "RSVP"}
        </Button>
      </div>

      {hasExistingRsvp ? (
        <div className="mt-3">
          <Button
            disabled={submitStatus === "saving" || rsvpStatus === "no"}
            onClick={onCancel}
            type="button"
            variant="ghost"
          >
            <XCircle className="size-4" aria-hidden="true" />
            Cancel RSVP
          </Button>
        </div>
      ) : null}

      {formError ? (
        <p className="mt-3 text-sm font-bold text-danger" role="alert">
          {formError}
        </p>
      ) : null}
    </form>
  );
}

function guestRsvpStorageKey(inviteToken: string) {
  return `pod-tracker:public-guest-rsvp:${inviteToken}`;
}

function readStoredGuestRsvpToken(inviteToken: string) {
  if (typeof window === "undefined") {
    return null;
  }

  return window.localStorage.getItem(guestRsvpStorageKey(inviteToken));
}

function storeGuestRsvpToken(inviteToken: string, rsvpToken: string) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(guestRsvpStorageKey(inviteToken), rsvpToken);
}

function clearStoredGuestRsvpToken(inviteToken: string) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.removeItem(guestRsvpStorageKey(inviteToken));
}

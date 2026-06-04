"use client";

import { CheckCircle2, CircleAlert, LoaderCircle, Send } from "lucide-react";
import { type FormEvent, useEffect, useState } from "react";

import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { FormField, fieldControlClassName } from "@/components/ui/form-field";
import type { PublicEventInviteView } from "@/features/events/public-event";
import { PublicEventInvite } from "./public-event-invite";

type PublicEventInviteResponse = {
  event: PublicEventInviteView;
};

type GuestRsvpStatus = "yes" | "maybe" | "no" | "waitlist";

type GuestRsvpFieldErrors = Partial<{
  guestName: string;
  status: string;
}>;

type GuestRsvpResponse = Partial<PublicEventInviteResponse> & {
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
  const [submitStatus, setSubmitStatus] = useState<
    "idle" | "saving" | "saved" | "error"
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
        `/api/public-events/${encodeURIComponent(inviteToken)}/guest-rsvp`,
        {
          method: "POST",
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

      if (!response.ok || !payload.event) {
        setFieldErrors(payload.fieldErrors ?? {});
        setFormError(payload.error ?? "Guest RSVP could not be saved.");
        setSubmitStatus("error");
        return;
      }

      setEvent(payload.event);
      setGuestName("");
      setRsvpStatus("yes");
      setSubmitStatus("saved");
    } catch {
      setFormError("Guest RSVP could not be saved.");
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
  onGuestNameChange,
  onStatusChange,
  onSubmit,
  rsvpStatus,
  submitStatus,
}: {
  fieldErrors: GuestRsvpFieldErrors;
  formError: string | null;
  guestName: string;
  onGuestNameChange: (name: string) => void;
  onStatusChange: (status: GuestRsvpStatus) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  rsvpStatus: GuestRsvpStatus;
  submitStatus: "idle" | "saving" | "saved" | "error";
}) {
  return (
    <form
      className="rounded-panel border border-border bg-surface p-4 shadow-sm"
      onSubmit={onSubmit}
    >
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold">Guest RSVP</h2>
        </div>
        {submitStatus === "saved" ? (
          <span className="inline-flex items-center gap-1.5 text-xs font-bold text-accent">
            <CheckCircle2 className="size-4" aria-hidden="true" />
            Saved
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
          ) : (
            <Send className="size-4" aria-hidden="true" />
          )}
          RSVP
        </Button>
      </div>

      {formError ? (
        <p className="mt-3 text-sm font-bold text-danger" role="alert">
          {formError}
        </p>
      ) : null}
    </form>
  );
}

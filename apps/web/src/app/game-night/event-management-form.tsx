"use client";

import { Archive, CalendarCog, CheckCircle2, XCircle } from "lucide-react";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { Button } from "@/components/ui/button";
import { fieldControlClassName, FormField } from "@/components/ui/form-field";
import type { EventPlanningSummary } from "@/db/queries/event-planning";
import {
  type EventStatusActionState,
  updateEventAction,
  updateEventStatusAction,
  type UpdateEventActionState,
} from "./actions";

type EventManagementFormProps = {
  event: EventPlanningSummary;
};

function createUpdateInitialState(
  event: EventPlanningSummary,
): UpdateEventActionState {
  return {
    message: null,
    saved: false,
    fieldErrors: {},
    fields: {
      eventId: event.id,
      title: event.title,
      startsAt: formatDateTimeLocalValue(event.startsAt),
      description: event.description,
      visibility: event.visibility,
    },
  };
}

function createStatusInitialState(
  event: EventPlanningSummary,
): EventStatusActionState {
  return {
    message: null,
    saved: false,
    fieldErrors: {},
    fields: {
      eventId: event.id,
      status: "cancelled",
    },
  };
}

export function EventManagementForm({ event }: EventManagementFormProps) {
  const [updateState, updateFormAction] = useActionState(
    updateEventAction,
    createUpdateInitialState(event),
  );
  const [statusState, statusFormAction] = useActionState(
    updateEventStatusAction,
    createStatusInitialState(event),
  );
  const statusMessageVariant = statusState.saved ? "success" : "danger";

  return (
    <div className="grid gap-4 border-t border-border pt-4">
      <form action={updateFormAction} className="grid gap-3">
        <input
          name="eventId"
          type="hidden"
          value={updateState.fields.eventId}
        />

        <StatusMessage
          message={updateState.message}
          saved={updateState.saved}
        />

        <div className="grid gap-3 lg:grid-cols-[1fr_0.85fr_0.75fr]">
          <FormField
            label="Edit Event Title"
            error={updateState.fieldErrors.title}
          >
            <input
              className={fieldControlClassName}
              defaultValue={updateState.fields.title}
              maxLength={100}
              name="title"
              required
            />
          </FormField>

          <FormField
            label="Edit Start"
            error={updateState.fieldErrors.startsAt}
          >
            <input
              className={fieldControlClassName}
              defaultValue={updateState.fields.startsAt}
              name="startsAt"
              required
              type="datetime-local"
            />
          </FormField>

          <FormField
            label="Edit Visibility"
            error={updateState.fieldErrors.visibility}
          >
            <select
              className={fieldControlClassName}
              defaultValue={updateState.fields.visibility}
              name="visibility"
              required
            >
              <option value="members">Members</option>
              <option value="invite_only">Invite Only</option>
              <option value="public_safe">Public Safe</option>
            </select>
          </FormField>
        </div>

        <FormField
          label="Edit Description"
          error={updateState.fieldErrors.description}
        >
          <textarea
            className={`${fieldControlClassName} min-h-20 resize-y py-2`}
            defaultValue={updateState.fields.description}
            maxLength={1000}
            name="description"
          />
        </FormField>

        {updateState.fieldErrors.eventId ? (
          <p className="text-sm font-semibold text-danger">
            {updateState.fieldErrors.eventId}
          </p>
        ) : null}

        <UpdateSubmitButton />
      </form>

      <form
        action={statusFormAction}
        className="grid gap-3 rounded-control bg-background p-3 sm:grid-cols-[1fr_auto_auto] sm:items-center"
      >
        <input
          name="eventId"
          type="hidden"
          value={statusState.fields.eventId}
        />

        <div>
          <StatusMessage
            message={statusState.message}
            saved={statusState.saved}
            variant={statusMessageVariant}
          />
          {statusState.fieldErrors.eventId || statusState.fieldErrors.status ? (
            <p className="text-sm font-semibold text-danger">
              {statusState.fieldErrors.eventId ??
                statusState.fieldErrors.status}
            </p>
          ) : null}
        </div>

        <StatusSubmitButton
          disabled={event.status === "cancelled"}
          status="cancelled"
        />
        <StatusSubmitButton status="archived" />
      </form>
    </div>
  );
}

function UpdateSubmitButton() {
  const { pending } = useFormStatus();

  return (
    <Button className="w-full sm:w-fit" disabled={pending} type="submit">
      <CalendarCog className="size-4" aria-hidden="true" />
      {pending ? "Updating" : "Update Event"}
    </Button>
  );
}

function StatusSubmitButton({
  disabled = false,
  status,
}: {
  disabled?: boolean;
  status: "cancelled" | "archived";
}) {
  const { pending } = useFormStatus();
  const isArchive = status === "archived";

  return (
    <Button
      className="w-full sm:w-auto"
      disabled={disabled || pending}
      name="status"
      type="submit"
      value={status}
      variant={isArchive ? "secondary" : "danger"}
    >
      {isArchive ? (
        <Archive className="size-4" aria-hidden="true" />
      ) : (
        <XCircle className="size-4" aria-hidden="true" />
      )}
      {pending ? "Saving" : isArchive ? "Archive Event" : "Cancel Event"}
    </Button>
  );
}

function StatusMessage({
  message,
  saved,
  variant = saved ? "success" : "danger",
}: {
  message: string | null;
  saved: boolean;
  variant?: "success" | "danger";
}) {
  if (!message) {
    return null;
  }

  return (
    <div
      className={
        variant === "success"
          ? "flex items-start gap-2 rounded-control border border-accent/40 bg-accent/10 p-3 text-sm font-semibold text-accent"
          : "flex items-start gap-2 rounded-control border border-danger/40 bg-danger/10 p-3 text-sm font-semibold text-danger"
      }
      role="status"
    >
      <CheckCircle2 className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      <span>{message}</span>
    </div>
  );
}

function formatDateTimeLocalValue(date: Date) {
  return date.toISOString().slice(0, 16);
}

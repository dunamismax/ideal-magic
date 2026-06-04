"use client";

import { CheckCircle2, Save } from "lucide-react";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { Button } from "@/components/ui/button";
import { fieldControlClassName, FormField } from "@/components/ui/form-field";
import type { RsvpStatus } from "@/db/queries/event-planning";
import {
  updateMemberRsvpAction,
  type UpdateMemberRsvpActionState,
} from "./actions";

type MemberRsvpFormProps = {
  eventId: string;
  initialStatus: RsvpStatus | null;
  initialArrivalTime: Date | null;
  initialLeavingTime: Date | null;
};

function createInitialState({
  eventId,
  initialStatus,
  initialArrivalTime,
  initialLeavingTime,
}: MemberRsvpFormProps): UpdateMemberRsvpActionState {
  return {
    message: null,
    saved: false,
    fieldErrors: {},
    fields: {
      eventId,
      status: initialStatus ?? "yes",
      arrivalTime: formatDateTimeLocalValue(initialArrivalTime),
      leavingTime: formatDateTimeLocalValue(initialLeavingTime),
    },
  };
}

export function MemberRsvpForm(props: MemberRsvpFormProps) {
  const [state, formAction] = useActionState(
    updateMemberRsvpAction,
    createInitialState(props),
  );

  return (
    <form
      action={formAction}
      className="grid gap-3 border-t border-border pt-4"
    >
      <input name="eventId" type="hidden" value={state.fields.eventId} />

      {state.message ? (
        <div
          className={
            state.saved
              ? "flex items-start gap-2 rounded-control border border-accent/40 bg-accent/10 p-3 text-sm font-semibold text-accent"
              : "flex items-start gap-2 rounded-control border border-danger/40 bg-danger/10 p-3 text-sm font-semibold text-danger"
          }
          role="status"
        >
          <CheckCircle2 className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <span>{state.message}</span>
        </div>
      ) : null}

      <div className="grid gap-3 lg:grid-cols-[0.8fr_1fr_1fr_auto] lg:items-end">
        <FormField label="RSVP Status" error={state.fieldErrors.status}>
          <select
            className={fieldControlClassName}
            defaultValue={state.fields.status}
            name="status"
            required
          >
            <option value="yes">Yes</option>
            <option value="maybe">Maybe</option>
            <option value="no">No</option>
            <option value="waitlist">Waitlist</option>
          </select>
        </FormField>

        <FormField label="Arrival" error={state.fieldErrors.arrivalTime}>
          <input
            className={fieldControlClassName}
            defaultValue={state.fields.arrivalTime}
            name="arrivalTime"
            type="datetime-local"
          />
        </FormField>

        <FormField label="Leaving" error={state.fieldErrors.leavingTime}>
          <input
            className={fieldControlClassName}
            defaultValue={state.fields.leavingTime}
            name="leavingTime"
            type="datetime-local"
          />
        </FormField>

        <SubmitButton />
      </div>

      {state.fieldErrors.eventId ? (
        <p className="text-sm font-semibold text-danger">
          {state.fieldErrors.eventId}
        </p>
      ) : null}
    </form>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <Button className="w-full lg:w-auto" disabled={pending} type="submit">
      <Save className="size-4" aria-hidden="true" />
      {pending ? "Saving" : "Save RSVP"}
    </Button>
  );
}

function formatDateTimeLocalValue(date: Date | null) {
  if (!date) {
    return "";
  }

  return date.toISOString().slice(0, 16);
}

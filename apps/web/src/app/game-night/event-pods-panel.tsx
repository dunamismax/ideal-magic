"use client";

import { CheckCircle2, Shuffle, UsersRound } from "lucide-react";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { Button } from "@/components/ui/button";
import type { EventPodSummary } from "@/db/queries/pods";
import { generatePodsAction, type GeneratePodsActionState } from "./actions";

type EventPodsPanelProps = {
  eventId: string;
  canManageEvent: boolean;
  pods: EventPodSummary[];
};

function createInitialState(eventId: string): GeneratePodsActionState {
  return {
    message: null,
    saved: false,
    fieldErrors: {},
    fields: {
      eventId,
    },
  };
}

export function EventPodsPanel({
  eventId,
  canManageEvent,
  pods,
}: EventPodsPanelProps) {
  const [state, formAction] = useActionState(
    generatePodsAction,
    createInitialState(eventId),
  );

  if (!canManageEvent && pods.length === 0) {
    return null;
  }

  return (
    <section className="grid gap-3 border-t border-border pt-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="flex items-center gap-2 text-sm font-black uppercase text-foreground">
            <UsersRound className="size-4 text-accent" aria-hidden="true" />
            Draft Pods
          </h3>
          <p className="mt-1 text-sm font-semibold text-muted">
            {pods.length > 0
              ? `${pods.length} draft pod${pods.length === 1 ? "" : "s"} ready`
              : "No draft pods generated."}
          </p>
        </div>

        {canManageEvent ? (
          <form action={formAction}>
            <input name="eventId" type="hidden" value={state.fields.eventId} />
            <GeneratePodsButton />
          </form>
        ) : null}
      </div>

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

      {state.fieldErrors.eventId ? (
        <p className="text-sm font-semibold text-danger">
          {state.fieldErrors.eventId}
        </p>
      ) : null}

      {pods.length > 0 ? (
        <div className="grid gap-3">
          {pods.map((pod) => (
            <PodBlock key={pod.id} pod={pod} />
          ))}
        </div>
      ) : null}
    </section>
  );
}

function GeneratePodsButton() {
  const { pending } = useFormStatus();

  return (
    <Button className="w-full sm:w-auto" disabled={pending} type="submit">
      <Shuffle className="size-4" aria-hidden="true" />
      {pending ? "Generating" : "Generate Draft Pods"}
    </Button>
  );
}

function PodBlock({ pod }: { pod: EventPodSummary }) {
  return (
    <div className="rounded-control border border-border bg-background p-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h4 className="text-sm font-black">{pod.name}</h4>
          <p className="text-xs font-bold uppercase text-muted">
            {formatPodState(pod.state)} - {pod.seats.length} seats - Score{" "}
            {pod.totalScore}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge value={`Size ${pod.sizeFitScore}`} />
          <Badge value={`Bracket ${pod.bracketCompatibilityScore}`} />
          <Badge value={`Availability ${pod.availabilityWindowScore}`} />
        </div>
      </div>

      <ol className="mt-3 grid gap-2">
        {pod.seats.map((seat) => (
          <li
            className="grid gap-2 rounded-control border border-border/70 bg-surface px-3 py-2 sm:grid-cols-[auto_1fr_auto] sm:items-center"
            key={seat.id}
          >
            <span className="inline-flex size-7 items-center justify-center rounded-full bg-accent text-xs font-black text-accent-foreground">
              {seat.seatPosition}
            </span>
            <div>
              <p className="text-sm font-black">{seat.participantName}</p>
              <p className="text-xs font-bold text-muted">
                {seat.deck
                  ? `${seat.deck.deckNameSnapshot} - ${seat.deck.commanderSnapshot.join(" / ")}`
                  : "No deck declared"}
              </p>
            </div>
            <div className="flex flex-wrap gap-2 sm:justify-end">
              <Badge value={formatRsvpStatus(seat.rsvpStatus)} />
              {seat.deck?.colorIdentitySnapshot ? (
                <Badge value={seat.deck.colorIdentitySnapshot} />
              ) : null}
              {seat.deck?.bracketSnapshot ? (
                <Badge value={`Bracket ${seat.deck.bracketSnapshot}`} />
              ) : null}
              {seat.deck?.powerEstimateSnapshot ? (
                <Badge value={`Power ${seat.deck.powerEstimateSnapshot}`} />
              ) : null}
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}

function Badge({ value }: { value: string }) {
  return (
    <span className="inline-flex w-fit items-center rounded-control border border-border bg-background px-2 py-1 text-xs font-bold uppercase text-muted">
      {value}
    </span>
  );
}

function formatPodState(state: EventPodSummary["state"]) {
  switch (state) {
    case "active":
      return "Active";
    case "cancelled":
      return "Cancelled";
    case "completed":
      return "Completed";
    case "locked":
      return "Locked";
    default:
      return "Proposed";
  }
}

function formatRsvpStatus(
  status: EventPodSummary["seats"][number]["rsvpStatus"],
) {
  switch (status) {
    case "maybe":
      return "Maybe";
    case "no":
      return "No";
    case "waitlist":
      return "Waitlist";
    default:
      return "Yes";
  }
}

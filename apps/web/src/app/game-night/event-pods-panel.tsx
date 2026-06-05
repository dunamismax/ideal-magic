"use client";

import {
  ArrowRightLeft,
  CheckCircle2,
  Shuffle,
  UsersRound,
} from "lucide-react";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { Button } from "@/components/ui/button";
import type { EventPodSummary } from "@/db/queries/pods";
import {
  generatePodsAction,
  movePodSeatAction,
  updatePodPublicationAction,
  type GeneratePodsActionState,
  type MovePodSeatActionState,
  type PodPublicationActionState,
} from "./actions";

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

function createPublicationInitialState(
  eventId: string,
): PodPublicationActionState {
  return {
    message: null,
    saved: false,
    fieldErrors: {},
    fields: {
      eventId,
      intent: "publish",
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
  const [publicationState, publicationFormAction] = useActionState(
    updatePodPublicationAction,
    createPublicationInitialState(eventId),
  );
  const hasPublishedPods = pods.some(
    (pod) => pod.state === "locked" && pod.publishedAt,
  );
  const allPodsProposed =
    pods.length > 0 && pods.every((pod) => pod.state === "proposed");
  const allPodsPublished =
    pods.length > 0 &&
    pods.every((pod) => pod.state === "locked" && pod.publishedAt);

  if (!canManageEvent && pods.length === 0) {
    return null;
  }

  return (
    <section className="grid gap-3 border-t border-border pt-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="flex items-center gap-2 text-sm font-black uppercase text-foreground">
            <UsersRound className="size-4 text-accent" aria-hidden="true" />
            {hasPublishedPods ? "Published Pods" : "Draft Pods"}
          </h3>
          <p className="mt-1 text-sm font-semibold text-muted">
            {pods.length > 0
              ? `${pods.length} ${hasPublishedPods ? "published" : "draft"} pod${pods.length === 1 ? "" : "s"} ready`
              : "No draft pods generated."}
          </p>
        </div>

        {canManageEvent ? (
          <div className="flex flex-col gap-2 sm:flex-row">
            <form action={formAction}>
              <input
                name="eventId"
                type="hidden"
                value={state.fields.eventId}
              />
              <GeneratePodsButton />
            </form>
            {pods.length > 0 ? (
              <form action={publicationFormAction}>
                <input
                  name="eventId"
                  type="hidden"
                  value={publicationState.fields.eventId}
                />
                <PodPublicationButton
                  disabled={!allPodsProposed && !allPodsPublished}
                  intent={allPodsPublished ? "unpublish" : "publish"}
                />
              </form>
            ) : null}
          </div>
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

      {publicationState.message ? (
        <div
          className={
            publicationState.saved
              ? "flex items-start gap-2 rounded-control border border-accent/40 bg-accent/10 p-3 text-sm font-semibold text-accent"
              : "flex items-start gap-2 rounded-control border border-danger/40 bg-danger/10 p-3 text-sm font-semibold text-danger"
          }
          role="status"
        >
          <CheckCircle2 className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <span>{publicationState.message}</span>
        </div>
      ) : null}

      {publicationState.fieldErrors.eventId ||
      publicationState.fieldErrors.intent ? (
        <p className="text-sm font-semibold text-danger">
          {publicationState.fieldErrors.eventId ??
            publicationState.fieldErrors.intent}
        </p>
      ) : null}

      {pods.length > 0 ? (
        <div className="grid gap-3">
          {pods.map((pod) => (
            <PodBlock
              canManageEvent={canManageEvent}
              eventId={eventId}
              key={pod.id}
              pod={pod}
              pods={pods}
            />
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

function PodPublicationButton({
  disabled,
  intent,
}: {
  disabled: boolean;
  intent: "publish" | "unpublish";
}) {
  const { pending } = useFormStatus();
  const isUnpublish = intent === "unpublish";

  return (
    <>
      <input name="intent" type="hidden" value={intent} />
      <Button
        className="w-full sm:w-auto"
        disabled={disabled || pending}
        type="submit"
        variant={isUnpublish ? "secondary" : "primary"}
      >
        <CheckCircle2 className="size-4" aria-hidden="true" />
        {pending
          ? isUnpublish
            ? "Unpublishing"
            : "Publishing"
          : isUnpublish
            ? "Unpublish Pods"
            : "Publish Pods"}
      </Button>
    </>
  );
}

function PodBlock({
  canManageEvent,
  eventId,
  pod,
  pods,
}: {
  canManageEvent: boolean;
  eventId: string;
  pod: EventPodSummary;
  pods: EventPodSummary[];
}) {
  return (
    <div
      aria-label={`${pod.name} pod assignment`}
      className="rounded-control border border-border bg-background p-3"
    >
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
            className="grid gap-2 rounded-control border border-border/70 bg-surface px-3 py-2 lg:grid-cols-[auto_1fr_auto] lg:items-center"
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
            {canManageEvent && pod.state === "proposed" ? (
              <MoveSeatForm
                eventId={eventId}
                pods={pods}
                seat={seat}
                sourcePod={pod}
              />
            ) : null}
          </li>
        ))}
      </ol>
    </div>
  );
}

function createMoveSeatInitialState(input: {
  eventId: string;
  seatId: string;
  targetPodId: string;
  targetSeatPosition: number;
}): MovePodSeatActionState {
  return {
    message: null,
    saved: false,
    fieldErrors: {},
    fields: {
      eventId: input.eventId,
      seatId: input.seatId,
      targetPodId: input.targetPodId,
      targetSeatPosition: input.targetSeatPosition,
    },
  };
}

function MoveSeatForm({
  eventId,
  pods,
  seat,
  sourcePod,
}: {
  eventId: string;
  pods: EventPodSummary[];
  seat: EventPodSummary["seats"][number];
  sourcePod: EventPodSummary;
}) {
  const [state, formAction] = useActionState(
    movePodSeatAction,
    createMoveSeatInitialState({
      eventId,
      seatId: seat.id,
      targetPodId: sourcePod.id,
      targetSeatPosition: seat.seatPosition,
    }),
  );
  const moveLabel = `Move ${seat.participantName}`;

  return (
    <form action={formAction} className="grid gap-2 lg:min-w-72">
      <input name="eventId" type="hidden" value={state.fields.eventId} />
      <input name="seatId" type="hidden" value={state.fields.seatId} />
      <div className="grid grid-cols-[1fr_5rem_auto] gap-2">
        <select
          aria-label={`${moveLabel} to pod`}
          className="h-9 rounded-control border border-border bg-background px-2 text-sm font-semibold text-foreground"
          defaultValue={state.fields.targetPodId}
          name="targetPodId"
        >
          {pods.map((pod) => (
            <option key={pod.id} value={pod.id}>
              {pod.name}
            </option>
          ))}
        </select>
        <input
          aria-label={`${moveLabel} to seat`}
          className="h-9 rounded-control border border-border bg-background px-2 text-sm font-semibold text-foreground"
          defaultValue={state.fields.targetSeatPosition}
          min={1}
          name="targetSeatPosition"
          type="number"
        />
        <MoveSeatButton label={moveLabel} />
      </div>
      {state.message ? (
        <p
          className={
            state.saved
              ? "text-xs font-bold text-accent"
              : "text-xs font-bold text-danger"
          }
          role="status"
        >
          {state.message}
        </p>
      ) : null}
      {state.fieldErrors.targetPodId ||
      state.fieldErrors.targetSeatPosition ||
      state.fieldErrors.seatId ? (
        <p className="text-xs font-bold text-danger">
          {state.fieldErrors.targetPodId ??
            state.fieldErrors.targetSeatPosition ??
            state.fieldErrors.seatId}
        </p>
      ) : null}
    </form>
  );
}

function MoveSeatButton({ label }: { label: string }) {
  const { pending } = useFormStatus();

  return (
    <Button
      aria-label={label}
      className="size-9 p-0"
      disabled={pending}
      title={label}
      type="submit"
      variant="secondary"
    >
      <ArrowRightLeft className="size-4" aria-hidden="true" />
    </Button>
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

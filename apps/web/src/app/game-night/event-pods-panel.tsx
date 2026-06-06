"use client";

import {
  ArrowRightLeft,
  CheckCircle2,
  Lock,
  PlayCircle,
  Shuffle,
  Trophy,
  Unlock,
  UsersRound,
} from "lucide-react";
import Link from "next/link";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { Button } from "@/components/ui/button";
import type { EventPodSummary } from "@/db/queries/pods";
import {
  generatePodsAction,
  logPodGameAction,
  movePodSeatAction,
  updatePodSeatLockAction,
  updatePodPublicationAction,
  type GeneratePodsActionState,
  type LogPodGameActionState,
  type MovePodSeatActionState,
  type PodPublicationActionState,
  type PodSeatLockActionState,
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
    <section className="grid min-w-0 gap-3 border-t border-border pt-4">
      <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
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
          <div className="flex min-w-0 flex-col gap-2 sm:flex-row">
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
        <div className="grid min-w-0 gap-3">
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
  const canLaunchLifeCounter = pod.state === "locked" && pod.publishedAt;

  return (
    <div
      aria-label={`${pod.name} pod assignment`}
      className="min-w-0 rounded-control border border-border bg-background p-3"
    >
      <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
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
          {canLaunchLifeCounter ? (
            <Button asChild size="sm" variant="primary">
              <Link
                aria-label={`Launch ${pod.name} life counter`}
                href={`/events/${eventId}/pods/${pod.id}/life`}
              >
                <PlayCircle className="size-4" aria-hidden="true" />
                Launch Counter
              </Link>
            </Button>
          ) : null}
        </div>
      </div>

      {canManageEvent && canLaunchLifeCounter ? (
        <LogPodGameForm eventId={eventId} pod={pod} />
      ) : null}

      <ol className="mt-3 grid min-w-0 gap-2">
        {pod.seats.map((seat) => (
          <li
            className="grid min-w-0 gap-2 rounded-control border border-border/70 bg-surface px-3 py-2 lg:grid-cols-[auto_minmax(0,1fr)_auto] lg:items-center"
            key={seat.id}
          >
            <span className="inline-flex size-7 items-center justify-center rounded-full bg-accent text-xs font-black text-accent-foreground">
              {seat.seatPosition}
            </span>
            <div className="min-w-0">
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
              {seat.locked ? <Badge value="Locked seat" /> : null}
            </div>
            {canManageEvent && pod.state === "proposed" ? (
              <div className="grid gap-2 lg:min-w-72">
                {seat.locked ? null : (
                  <MoveSeatForm
                    eventId={eventId}
                    pods={pods}
                    seat={seat}
                    sourcePod={pod}
                  />
                )}
                <LockSeatForm eventId={eventId} seat={seat} />
              </div>
            ) : null}
          </li>
        ))}
      </ol>
    </div>
  );
}

function createLogPodGameInitialState(input: {
  eventId: string;
  podId: string;
}): LogPodGameActionState {
  return {
    message: null,
    saved: false,
    fieldErrors: {},
    fields: {
      eventId: input.eventId,
      podId: input.podId,
      resultType: "normal_win",
      winnerSeatIds: [],
      notes: "",
      playerOutcomes: [],
    },
  };
}

function LogPodGameForm({
  eventId,
  pod,
}: {
  eventId: string;
  pod: EventPodSummary;
}) {
  const [state, formAction] = useActionState(
    logPodGameAction,
    createLogPodGameInitialState({
      eventId,
      podId: pod.id,
    }),
  );

  return (
    <form
      action={formAction}
      className="mt-3 grid min-w-0 gap-2 rounded-control border border-border bg-surface px-3 py-2 lg:grid-cols-[10rem_minmax(0,1fr)_minmax(0,1fr)_auto] lg:items-start"
    >
      <input name="eventId" type="hidden" value={state.fields.eventId} />
      <input name="podId" type="hidden" value={state.fields.podId} />
      <select
        aria-label={`Result for ${pod.name}`}
        className="h-9 min-w-0 rounded-control border border-border bg-background px-2 text-sm font-semibold text-foreground"
        defaultValue={state.fields.resultType}
        name="resultType"
      >
        <option value="normal_win">Normal win</option>
        <option value="combat_win">Combat win</option>
        <option value="combo_win">Combo win</option>
        <option value="concession">Concession</option>
        <option value="archenemy_win">Archenemy win</option>
        <option value="team_win">Team win</option>
        <option value="draw">Draw</option>
        <option value="time_called">Time called</option>
        <option value="unfinished">Unfinished</option>
      </select>
      <fieldset className="grid min-w-0 gap-1 rounded-control border border-border bg-background px-2 py-1.5">
        <legend className="sr-only">Winners for {pod.name}</legend>
        <span
          className="text-[0.7rem] font-black uppercase text-muted"
          id={`${pod.id}-winner-seats-label`}
        >
          Winners
        </span>
        <div
          aria-labelledby={`${pod.id}-winner-seats-label`}
          className="flex flex-wrap gap-2"
          role="group"
        >
          {pod.seats.map((seat) => (
            <label
              className="inline-flex items-center gap-1 text-xs font-bold text-foreground"
              key={seat.id}
            >
              <input
                className="size-4 accent-current"
                defaultChecked={state.fields.winnerSeatIds.includes(seat.id)}
                name="winnerSeatIds"
                type="checkbox"
                value={seat.id}
              />
              Seat {seat.seatPosition}
            </label>
          ))}
        </div>
      </fieldset>
      <fieldset className="grid min-w-0 gap-2 rounded-control border border-border bg-background px-2 py-1.5 lg:col-span-4">
        <legend className="sr-only">
          Finish order and losses for {pod.name}
        </legend>
        <span className="text-[0.7rem] font-black uppercase text-muted">
          Finish and Loss Details
        </span>
        <div className="grid min-w-0 gap-2">
          {pod.seats.map((seat) => (
            <OutcomeFields
              key={seat.id}
              label={`Seat ${seat.seatPosition}: ${seat.participantName}`}
              playerId={seat.id}
            />
          ))}
        </div>
      </fieldset>
      <input
        aria-label={`Notes for ${pod.name}`}
        className="h-9 min-w-0 rounded-control border border-border bg-background px-2 text-sm font-semibold text-foreground"
        defaultValue={state.fields.notes}
        name="notes"
        placeholder="Notes"
      />
      <LogPodGameButton podName={pod.name} />
      {state.message ? (
        <p
          className={
            state.saved
              ? "text-xs font-bold text-accent lg:col-span-4"
              : "text-xs font-bold text-danger lg:col-span-4"
          }
          role="status"
        >
          {state.message}
        </p>
      ) : null}
      {state.fieldErrors.eventId ||
      state.fieldErrors.podId ||
      state.fieldErrors.resultType ||
      state.fieldErrors.winnerSeatIds ||
      state.fieldErrors.playerOutcomes ? (
        <p className="text-xs font-bold text-danger lg:col-span-4">
          {state.fieldErrors.eventId ??
            state.fieldErrors.podId ??
            state.fieldErrors.resultType ??
            state.fieldErrors.winnerSeatIds ??
            state.fieldErrors.playerOutcomes}
        </p>
      ) : null}
    </form>
  );
}

function OutcomeFields({
  label,
  playerId,
}: {
  label: string;
  playerId: string;
}) {
  return (
    <div className="grid min-w-0 gap-2 rounded-control border border-border/70 bg-surface p-2 2xl:grid-cols-[minmax(9rem,1fr)_5rem_5rem_5rem_8rem_minmax(8rem,1fr)_5rem_minmax(7rem,1fr)_5rem] 2xl:items-center">
      <input name="playerOutcomeIds" type="hidden" value={playerId} />
      <p className="text-xs font-black text-foreground">{label}</p>
      <input
        aria-label={`${label} finish position`}
        className="h-8 rounded-control border border-border bg-background px-2 text-xs font-semibold text-foreground"
        min={1}
        name={`finishPosition:${playerId}`}
        placeholder="Finish"
        type="number"
      />
      <input
        aria-label={`${label} elimination order`}
        className="h-8 rounded-control border border-border bg-background px-2 text-xs font-semibold text-foreground"
        min={1}
        name={`eliminationOrder:${playerId}`}
        placeholder="Elim"
        type="number"
      />
      <input
        aria-label={`${label} eliminated turn`}
        className="h-8 rounded-control border border-border bg-background px-2 text-xs font-semibold text-foreground"
        min={1}
        name={`eliminatedTurn:${playerId}`}
        placeholder="Turn"
        type="number"
      />
      <select
        aria-label={`${label} loss reason`}
        className="h-8 rounded-control border border-border bg-background px-2 text-xs font-semibold text-foreground"
        name={`lossReason:${playerId}`}
      >
        <option value="">Loss</option>
        <option value="combat_damage">Combat</option>
        <option value="commander_damage">Commander</option>
        <option value="poison">Poison</option>
        <option value="combo">Combo</option>
        <option value="concession">Concession</option>
        <option value="decked">Decked</option>
        <option value="life_total">Life</option>
        <option value="other">Other</option>
        <option value="unknown">Unknown</option>
      </select>
      <input
        aria-label={`${label} loss detail`}
        className="h-8 rounded-control border border-border bg-background px-2 text-xs font-semibold text-foreground"
        name={`lossDetail:${playerId}`}
        placeholder="Detail"
      />
      <input
        aria-label={`${label} poison counters`}
        className="h-8 rounded-control border border-border bg-background px-2 text-xs font-semibold text-foreground"
        min={1}
        name={`poisonCounters:${playerId}`}
        placeholder="Poison"
        type="number"
      />
      <input
        aria-label={`${label} commander damage source`}
        className="h-8 rounded-control border border-border bg-background px-2 text-xs font-semibold text-foreground"
        name={`commanderDamageSource:${playerId}`}
        placeholder="Commander"
      />
      <input
        aria-label={`${label} commander damage amount`}
        className="h-8 rounded-control border border-border bg-background px-2 text-xs font-semibold text-foreground"
        min={1}
        name={`commanderDamageAmount:${playerId}`}
        placeholder="Damage"
        type="number"
      />
    </div>
  );
}

function LogPodGameButton({ podName }: { podName: string }) {
  const { pending } = useFormStatus();

  return (
    <Button
      aria-label={`Log game for ${podName}`}
      className="w-full justify-center lg:w-auto"
      disabled={pending}
      title={`Log game for ${podName}`}
      type="submit"
      variant="primary"
    >
      <Trophy className="size-4" aria-hidden="true" />
      {pending ? "Logging" : "Log Game"}
    </Button>
  );
}

function createLockSeatInitialState(input: {
  eventId: string;
  seatId: string;
  locked: boolean;
}): PodSeatLockActionState {
  return {
    message: null,
    saved: false,
    fieldErrors: {},
    fields: {
      eventId: input.eventId,
      seatId: input.seatId,
      intent: input.locked ? "unlock" : "lock",
    },
  };
}

function LockSeatForm({
  eventId,
  seat,
}: {
  eventId: string;
  seat: EventPodSummary["seats"][number];
}) {
  const [state, formAction] = useActionState(
    updatePodSeatLockAction,
    createLockSeatInitialState({
      eventId,
      seatId: seat.id,
      locked: seat.locked,
    }),
  );
  const intent = seat.locked ? "unlock" : "lock";
  const lockLabel =
    intent === "lock"
      ? `Lock ${seat.participantName}`
      : `Unlock ${seat.participantName}`;

  return (
    <form action={formAction} className="grid gap-2">
      <input name="eventId" type="hidden" value={state.fields.eventId} />
      <input name="seatId" type="hidden" value={state.fields.seatId} />
      <input name="intent" type="hidden" value={intent} />
      <LockSeatButton intent={intent} label={lockLabel} />
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
      {state.fieldErrors.eventId ||
      state.fieldErrors.seatId ||
      state.fieldErrors.intent ? (
        <p className="text-xs font-bold text-danger">
          {state.fieldErrors.eventId ??
            state.fieldErrors.seatId ??
            state.fieldErrors.intent}
        </p>
      ) : null}
    </form>
  );
}

function LockSeatButton({
  intent,
  label,
}: {
  intent: "lock" | "unlock";
  label: string;
}) {
  const { pending } = useFormStatus();
  const Icon = intent === "lock" ? Lock : Unlock;

  return (
    <Button
      aria-label={label}
      className="w-full justify-center"
      disabled={pending}
      title={label}
      type="submit"
      variant={intent === "lock" ? "secondary" : "primary"}
    >
      <Icon className="size-4" aria-hidden="true" />
      {pending ? "Saving" : intent === "lock" ? "Lock Seat" : "Unlock Seat"}
    </Button>
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
    <form action={formAction} className="grid gap-2">
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

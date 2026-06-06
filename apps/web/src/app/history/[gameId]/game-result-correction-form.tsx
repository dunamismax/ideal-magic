"use client";

import { RotateCcw } from "lucide-react";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { Button } from "@/components/ui/button";
import type { LoggedGameHistorySummary } from "@/db/queries/games";
import {
  correctGameResultAction,
  type CorrectGameResultActionState,
} from "./actions";

type GameResultCorrectionFormProps = {
  game: LoggedGameHistorySummary;
};

export function GameResultCorrectionForm({
  game,
}: GameResultCorrectionFormProps) {
  const [state, formAction] = useActionState(
    correctGameResultAction,
    createCorrectionInitialState(game),
  );

  return (
    <section className="rounded-panel border border-border bg-surface p-4 shadow-sm">
      <div className="flex flex-col gap-1">
        <p className="text-xs font-bold uppercase text-muted">Correction</p>
        <h2 className="text-base font-black">Result Correction</h2>
      </div>

      <form
        action={formAction}
        aria-label="Correct game result"
        className="mt-4 grid gap-3"
      >
        <input name="gameId" type="hidden" value={state.fields.gameId} />
        <div className="grid gap-3 lg:grid-cols-[12rem_1fr] lg:items-start">
          <label className="grid gap-1 text-xs font-bold uppercase text-muted">
            Result
            <select
              className="h-10 rounded-control border border-border bg-background px-3 text-sm font-semibold normal-case text-foreground"
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
          </label>

          <fieldset className="grid gap-2 rounded-control border border-border bg-background p-3">
            <legend className="text-xs font-bold uppercase text-muted">
              Winners
            </legend>
            <div className="flex flex-wrap gap-3">
              {game.players.map((player) => (
                <label
                  className="inline-flex items-center gap-2 text-sm font-bold text-foreground"
                  key={player.id}
                >
                  <input
                    className="size-4 accent-current"
                    defaultChecked={state.fields.winnerPlayerIds.includes(
                      player.id,
                    )}
                    name="winnerPlayerIds"
                    type="checkbox"
                    value={player.id}
                  />
                  {player.participantName}
                </label>
              ))}
            </div>
          </fieldset>
        </div>

        <fieldset className="grid gap-2 rounded-control border border-border bg-background p-3">
          <legend className="text-xs font-bold uppercase text-muted">
            Finish And Loss Details
          </legend>
          {game.players.map((player) => (
            <OutcomeFields key={player.id} player={player} />
          ))}
        </fieldset>

        <label className="grid gap-1 text-xs font-bold uppercase text-muted">
          Notes
          <textarea
            className="min-h-20 rounded-control border border-border bg-background px-3 py-2 text-sm font-semibold normal-case text-foreground"
            defaultValue={state.fields.notes}
            name="notes"
          />
        </label>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <SaveCorrectionButton />
          {state.message ? (
            <p
              className={
                state.saved
                  ? "text-sm font-bold text-accent"
                  : "text-sm font-bold text-danger"
              }
              role="status"
            >
              {state.message}
            </p>
          ) : null}
        </div>

        {state.fieldErrors.gameId ||
        state.fieldErrors.resultType ||
        state.fieldErrors.winnerPlayerIds ||
        state.fieldErrors.playerOutcomes ? (
          <p className="text-sm font-bold text-danger">
            {state.fieldErrors.gameId ??
              state.fieldErrors.resultType ??
              state.fieldErrors.winnerPlayerIds ??
              state.fieldErrors.playerOutcomes}
          </p>
        ) : null}
      </form>
    </section>
  );
}

function OutcomeFields({
  player,
}: {
  player: LoggedGameHistorySummary["players"][number];
}) {
  const label = `Seat ${player.seatPosition}: ${player.participantName}`;

  return (
    <div className="grid gap-2 rounded-control border border-border/70 bg-surface p-2 md:grid-cols-[minmax(9rem,1fr)_5rem_5rem_5rem_8rem_minmax(8rem,1fr)_5rem_minmax(7rem,1fr)_5rem] md:items-center">
      <input name="playerOutcomeIds" type="hidden" value={player.id} />
      <p className="text-xs font-black text-foreground">{label}</p>
      <input
        aria-label={`${label} finish position`}
        className="h-8 rounded-control border border-border bg-background px-2 text-xs font-semibold text-foreground"
        defaultValue={player.finishPosition ?? ""}
        min={1}
        name={`finishPosition:${player.id}`}
        placeholder="Finish"
        type="number"
      />
      <input
        aria-label={`${label} elimination order`}
        className="h-8 rounded-control border border-border bg-background px-2 text-xs font-semibold text-foreground"
        defaultValue={player.eliminationOrder ?? ""}
        min={1}
        name={`eliminationOrder:${player.id}`}
        placeholder="Elim"
        type="number"
      />
      <input
        aria-label={`${label} eliminated turn`}
        className="h-8 rounded-control border border-border bg-background px-2 text-xs font-semibold text-foreground"
        defaultValue={player.eliminatedTurn ?? ""}
        min={1}
        name={`eliminatedTurn:${player.id}`}
        placeholder="Turn"
        type="number"
      />
      <select
        aria-label={`${label} loss reason`}
        className="h-8 rounded-control border border-border bg-background px-2 text-xs font-semibold text-foreground"
        defaultValue={player.lossReason ?? ""}
        name={`lossReason:${player.id}`}
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
        defaultValue={player.lossDetail}
        name={`lossDetail:${player.id}`}
        placeholder="Detail"
      />
      <input
        aria-label={`${label} poison counters`}
        className="h-8 rounded-control border border-border bg-background px-2 text-xs font-semibold text-foreground"
        defaultValue={player.poisonCounters ?? ""}
        min={1}
        name={`poisonCounters:${player.id}`}
        placeholder="Poison"
        type="number"
      />
      <input
        aria-label={`${label} commander damage source`}
        className="h-8 rounded-control border border-border bg-background px-2 text-xs font-semibold text-foreground"
        defaultValue={player.commanderDamageSource}
        name={`commanderDamageSource:${player.id}`}
        placeholder="Commander"
      />
      <input
        aria-label={`${label} commander damage amount`}
        className="h-8 rounded-control border border-border bg-background px-2 text-xs font-semibold text-foreground"
        defaultValue={player.commanderDamageAmount ?? ""}
        min={1}
        name={`commanderDamageAmount:${player.id}`}
        placeholder="Damage"
        type="number"
      />
    </div>
  );
}

function SaveCorrectionButton() {
  const { pending } = useFormStatus();

  return (
    <Button disabled={pending} type="submit" variant="primary">
      <RotateCcw className="size-4" aria-hidden="true" />
      {pending ? "Saving" : "Save Correction"}
    </Button>
  );
}

function createCorrectionInitialState(
  game: LoggedGameHistorySummary,
): CorrectGameResultActionState {
  return {
    message: null,
    saved: false,
    fieldErrors: {},
    fields: {
      gameId: game.id,
      resultType: game.resultType,
      winnerPlayerIds: game.winners.map((winner) => winner.id),
      playerOutcomes: game.players.map((player) => ({
        playerId: player.id,
        finishPosition: player.finishPosition,
        eliminationOrder: player.eliminationOrder,
        eliminatedTurn: player.eliminatedTurn,
        lossReason: player.lossReason,
        lossDetail: player.lossDetail,
        poisonCounters: player.poisonCounters,
        commanderDamageSource: player.commanderDamageSource,
        commanderDamageAmount: player.commanderDamageAmount,
      })),
      notes: game.notes,
    },
  };
}

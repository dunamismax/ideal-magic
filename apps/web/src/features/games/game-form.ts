import type { GameResultType } from "@/db/queries/games";

export type LogPodGameInput = {
  eventId: string;
  podId: string;
  resultType: GameResultType;
  winnerSeatId: string;
  notes: string;
};

export type LogPodGameValidationResult =
  | {
      ok: true;
      input: {
        eventId: string;
        podId: string;
        resultType: GameResultType;
        winnerSeatIds: string[];
        notes: string;
      };
    }
  | {
      ok: false;
      fieldErrors: Partial<Record<keyof LogPodGameInput, string>>;
      fields: LogPodGameInput;
    };

const resultTypes = [
  "normal_win",
  "combo_win",
  "combat_win",
  "concession",
  "draw",
  "time_called",
  "unfinished",
  "archenemy_win",
  "team_win",
] as const;

export function validateLogPodGameInput(
  rawInput: Partial<Record<keyof LogPodGameInput, FormDataEntryValue | string>>,
): LogPodGameValidationResult {
  const fields: LogPodGameInput = {
    eventId: normalizeText(rawInput.eventId),
    podId: normalizeText(rawInput.podId),
    resultType: normalizeResultType(rawInput.resultType),
    winnerSeatId: normalizeText(rawInput.winnerSeatId),
    notes: normalizeText(rawInput.notes),
  };
  const fieldErrors: Partial<Record<keyof LogPodGameInput, string>> = {};

  if (!isUuid(fields.eventId)) {
    fieldErrors.eventId = "Choose an event.";
  }

  if (!isUuid(fields.podId)) {
    fieldErrors.podId = "Choose a pod.";
  }

  if (!isResultType(normalizeText(rawInput.resultType))) {
    fieldErrors.resultType = "Choose a result.";
  }

  if (fields.winnerSeatId && !isUuid(fields.winnerSeatId)) {
    fieldErrors.winnerSeatId = "Choose a winner from this pod.";
  }

  if (Object.keys(fieldErrors).length > 0) {
    return {
      ok: false,
      fieldErrors,
      fields,
    };
  }

  return {
    ok: true,
    input: {
      eventId: fields.eventId,
      podId: fields.podId,
      resultType: fields.resultType,
      winnerSeatIds: fields.winnerSeatId ? [fields.winnerSeatId] : [],
      notes: fields.notes,
    },
  };
}

function normalizeResultType(
  value: FormDataEntryValue | string | undefined,
): GameResultType {
  const normalized = normalizeText(value);

  return isResultType(normalized) ? normalized : "normal_win";
}

function isResultType(value: string): value is GameResultType {
  return resultTypes.includes(value as GameResultType);
}

function normalizeText(value: FormDataEntryValue | string | undefined) {
  return String(value ?? "").trim();
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}

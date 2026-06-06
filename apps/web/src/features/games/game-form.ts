import type { GameResultType } from "@/db/queries/games";
import {
  getPlayerOutcomeValidationError,
  type GamePlayerOutcomeInput,
  isUuid,
  normalizeGamePlayerOutcomes,
} from "./player-outcomes";

export type LogPodGameInput = {
  eventId: string;
  podId: string;
  resultType: GameResultType;
  winnerSeatIds: string[];
  playerOutcomes: GamePlayerOutcomeInput[];
  notes: string;
};

export type CorrectGameResultInput = {
  gameId: string;
  resultType: GameResultType;
  winnerPlayerIds: string[];
  playerOutcomes: GamePlayerOutcomeInput[];
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
        playerOutcomes: GamePlayerOutcomeInput[];
        notes: string;
      };
    }
  | {
      ok: false;
      fieldErrors: Partial<Record<keyof LogPodGameInput, string>>;
      fields: LogPodGameInput;
    };

export type CorrectGameResultValidationResult =
  | {
      ok: true;
      input: CorrectGameResultInput;
    }
  | {
      ok: false;
      fieldErrors: Partial<Record<keyof CorrectGameResultInput, string>>;
      fields: CorrectGameResultInput;
    };

type LogPodGameRawInput = Partial<
  Record<
    keyof Omit<LogPodGameInput, "playerOutcomes">,
    FormDataEntryValue | string | readonly (FormDataEntryValue | string)[]
  >
> & {
  playerOutcomes?: readonly Partial<GamePlayerOutcomeInput>[];
};

type CorrectGameResultRawInput = Partial<
  Record<
    keyof Omit<CorrectGameResultInput, "playerOutcomes">,
    FormDataEntryValue | string | readonly (FormDataEntryValue | string)[]
  >
> & {
  playerOutcomes?: readonly Partial<GamePlayerOutcomeInput>[];
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
const singleWinnerResultTypes = [
  "normal_win",
  "combo_win",
  "combat_win",
  "concession",
  "archenemy_win",
] as const satisfies readonly GameResultType[];
const noWinnerResultTypes = [
  "draw",
  "time_called",
  "unfinished",
] as const satisfies readonly GameResultType[];

export function validateLogPodGameInput(
  rawInput: LogPodGameRawInput,
): LogPodGameValidationResult {
  const fields: LogPodGameInput = {
    eventId: normalizeText(rawInput.eventId),
    podId: normalizeText(rawInput.podId),
    resultType: normalizeResultType(rawInput.resultType),
    winnerSeatIds: normalizeWinnerSeatIds(rawInput.winnerSeatIds),
    playerOutcomes: normalizeGamePlayerOutcomes(rawInput.playerOutcomes),
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

  validateWinnerFields({
    fieldErrors,
    resultType: fields.resultType,
    winnerIds: fields.winnerSeatIds,
    fieldName: "winnerSeatIds",
    invalidMessage: "Choose winners from this pod.",
  });

  const playerOutcomeError = getPlayerOutcomeValidationError(
    fields.playerOutcomes,
  );

  if (playerOutcomeError) {
    fieldErrors.playerOutcomes = playerOutcomeError;
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
      winnerSeatIds: fields.winnerSeatIds,
      playerOutcomes: fields.playerOutcomes,
      notes: fields.notes,
    },
  };
}

export function validateCorrectGameResultInput(
  rawInput: CorrectGameResultRawInput,
): CorrectGameResultValidationResult {
  const fields: CorrectGameResultInput = {
    gameId: normalizeText(rawInput.gameId),
    resultType: normalizeResultType(rawInput.resultType),
    winnerPlayerIds: normalizeWinnerSeatIds(rawInput.winnerPlayerIds),
    playerOutcomes: normalizeGamePlayerOutcomes(rawInput.playerOutcomes),
    notes: normalizeText(rawInput.notes),
  };
  const fieldErrors: Partial<Record<keyof CorrectGameResultInput, string>> = {};

  if (!isUuid(fields.gameId)) {
    fieldErrors.gameId = "Choose a logged game.";
  }

  if (!isResultType(normalizeText(rawInput.resultType))) {
    fieldErrors.resultType = "Choose a result.";
  }

  validateWinnerFields({
    fieldErrors,
    resultType: fields.resultType,
    winnerIds: fields.winnerPlayerIds,
    fieldName: "winnerPlayerIds",
    invalidMessage: "Choose winners from this game.",
  });

  const playerOutcomeError = getPlayerOutcomeValidationError(
    fields.playerOutcomes,
  );

  if (playerOutcomeError) {
    fieldErrors.playerOutcomes = playerOutcomeError;
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
    input: fields,
  };
}

function normalizeResultType(
  value:
    | FormDataEntryValue
    | string
    | readonly (FormDataEntryValue | string)[]
    | undefined,
): GameResultType {
  const normalized = normalizeText(value);

  return isResultType(normalized) ? normalized : "normal_win";
}

function isResultType(value: string): value is GameResultType {
  return resultTypes.includes(value as GameResultType);
}

function normalizeText(
  value:
    | FormDataEntryValue
    | string
    | readonly (FormDataEntryValue | string)[]
    | undefined,
) {
  if (Array.isArray(value)) {
    return normalizeText(value[0]);
  }

  return String(value ?? "").trim();
}

function normalizeWinnerSeatIds(
  value:
    | FormDataEntryValue
    | string
    | readonly (FormDataEntryValue | string)[]
    | undefined,
) {
  const values = Array.isArray(value) ? value : [value];
  const uniqueWinnerSeatIds = new Set<string>();

  for (const rawValue of values) {
    const winnerSeatId = normalizeText(rawValue);

    if (winnerSeatId) {
      uniqueWinnerSeatIds.add(winnerSeatId);
    }
  }

  return [...uniqueWinnerSeatIds];
}

function validateWinnerFields<
  TFields extends Partial<Record<string, string>>,
>(input: {
  fieldErrors: TFields;
  resultType: GameResultType;
  winnerIds: readonly string[];
  fieldName: keyof TFields;
  invalidMessage: string;
}) {
  if (input.winnerIds.some((winnerId) => !isUuid(winnerId))) {
    input.fieldErrors[input.fieldName] =
      input.invalidMessage as TFields[keyof TFields];
  } else if (requiresSingleWinner(input.resultType)) {
    if (input.winnerIds.length !== 1) {
      input.fieldErrors[input.fieldName] =
        "Choose exactly one winner for this result." as TFields[keyof TFields];
    }
  } else if (input.resultType === "team_win") {
    if (input.winnerIds.length < 2) {
      input.fieldErrors[input.fieldName] =
        "Choose at least two winners for a team win." as TFields[keyof TFields];
    }
  } else if (isNoWinnerResultType(input.resultType)) {
    if (input.winnerIds.length > 0) {
      input.fieldErrors[input.fieldName] =
        "Draw, time called, and unfinished games do not use winners." as TFields[keyof TFields];
    }
  }
}

function requiresSingleWinner(resultType: GameResultType) {
  return singleWinnerResultTypes.includes(
    resultType as (typeof singleWinnerResultTypes)[number],
  );
}

function isNoWinnerResultType(resultType: GameResultType) {
  return noWinnerResultTypes.includes(
    resultType as (typeof noWinnerResultTypes)[number],
  );
}

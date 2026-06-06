import type { GameResultType } from "@/db/queries/games";
import {
  getPlayerOutcomeValidationError,
  type GamePlayerOutcomeInput,
  isUuid,
  normalizeGamePlayerOutcomes,
} from "@/features/games/player-outcomes";

export type SaveEventLifeGameInput = {
  eventId: string;
  resultType: GameResultType;
  winnerParticipantIds: string[];
  playerOutcomes: GamePlayerOutcomeInput[];
  notes: string;
};

export type SaveEventLifeGameActionState = {
  message: string | null;
  saved: boolean;
  savedGameId: string | null;
  fieldErrors: Partial<Record<keyof SaveEventLifeGameInput, string>>;
  fields: SaveEventLifeGameInput;
};

export type SaveEventLifeGameValidationResult =
  | {
      ok: true;
      input: SaveEventLifeGameInput;
    }
  | {
      ok: false;
      fieldErrors: Partial<Record<keyof SaveEventLifeGameInput, string>>;
      fields: SaveEventLifeGameInput;
    };

type SaveEventLifeGameRawInput = Partial<
  Record<
    keyof Omit<SaveEventLifeGameInput, "playerOutcomes">,
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

export function validateSaveEventLifeGameInput(
  rawInput: SaveEventLifeGameRawInput,
): SaveEventLifeGameValidationResult {
  const fields: SaveEventLifeGameInput = {
    eventId: normalizeText(rawInput.eventId),
    resultType: normalizeResultType(rawInput.resultType),
    winnerParticipantIds: normalizeWinnerParticipantIds(
      rawInput.winnerParticipantIds,
    ),
    playerOutcomes: normalizeGamePlayerOutcomes(rawInput.playerOutcomes),
    notes: normalizeText(rawInput.notes),
  };
  const fieldErrors: Partial<Record<keyof SaveEventLifeGameInput, string>> = {};

  if (!isUuid(fields.eventId)) {
    fieldErrors.eventId = "Choose an event.";
  }

  if (!isResultType(normalizeText(rawInput.resultType))) {
    fieldErrors.resultType = "Choose a result.";
  }

  if (
    fields.winnerParticipantIds.some(
      (winnerParticipantId) => !isUuid(winnerParticipantId),
    )
  ) {
    fieldErrors.winnerParticipantIds =
      "Choose winners from this event counter.";
  } else if (requiresSingleWinner(fields.resultType)) {
    if (fields.winnerParticipantIds.length !== 1) {
      fieldErrors.winnerParticipantIds =
        "Choose exactly one winner for this result.";
    }
  } else if (fields.resultType === "team_win") {
    if (fields.winnerParticipantIds.length < 2) {
      fieldErrors.winnerParticipantIds =
        "Choose at least two winners for a team win.";
    }
  } else if (isNoWinnerResultType(fields.resultType)) {
    if (fields.winnerParticipantIds.length > 0) {
      fieldErrors.winnerParticipantIds =
        "Draw, time called, and unfinished games do not use winners.";
    }
  }

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

function normalizeWinnerParticipantIds(
  value:
    | FormDataEntryValue
    | string
    | readonly (FormDataEntryValue | string)[]
    | undefined,
) {
  const values = Array.isArray(value) ? value : [value];
  const uniqueWinnerParticipantIds = new Set<string>();

  for (const rawValue of values) {
    const winnerParticipantId = normalizeText(rawValue);

    if (winnerParticipantId) {
      uniqueWinnerParticipantIds.add(winnerParticipantId);
    }
  }

  return [...uniqueWinnerParticipantIds];
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

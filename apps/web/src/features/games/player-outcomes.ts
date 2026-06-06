export type GameLossReason =
  | "combat_damage"
  | "commander_damage"
  | "poison"
  | "combo"
  | "concession"
  | "decked"
  | "life_total"
  | "other"
  | "unknown";

export type GamePlayerOutcomeInput = {
  playerId: string;
  finishPosition: number | null;
  eliminationOrder: number | null;
  eliminatedTurn: number | null;
  lossReason: GameLossReason | null;
  lossDetail: string;
  poisonCounters: number | null;
  commanderDamageSource: string;
  commanderDamageAmount: number | null;
};

export const gameLossReasons = [
  "combat_damage",
  "commander_damage",
  "poison",
  "combo",
  "concession",
  "decked",
  "life_total",
  "other",
  "unknown",
] as const satisfies readonly GameLossReason[];

export function readGamePlayerOutcomesFromFormData(
  formData: FormData,
): GamePlayerOutcomeInput[] {
  const playerIds = uniqueNormalizedValues(formData.getAll("playerOutcomeIds"));

  return playerIds.map((playerId) => ({
    playerId,
    finishPosition: normalizePositiveInteger(
      formData.get(`finishPosition:${playerId}`),
    ),
    eliminationOrder: normalizePositiveInteger(
      formData.get(`eliminationOrder:${playerId}`),
    ),
    eliminatedTurn: normalizePositiveInteger(
      formData.get(`eliminatedTurn:${playerId}`),
    ),
    lossReason: normalizeLossReason(formData.get(`lossReason:${playerId}`)),
    lossDetail: normalizeText(formData.get(`lossDetail:${playerId}`)),
    poisonCounters: normalizePositiveInteger(
      formData.get(`poisonCounters:${playerId}`),
    ),
    commanderDamageSource: normalizeText(
      formData.get(`commanderDamageSource:${playerId}`),
    ),
    commanderDamageAmount: normalizePositiveInteger(
      formData.get(`commanderDamageAmount:${playerId}`),
    ),
  }));
}

export function normalizeGamePlayerOutcomes(
  value:
    | readonly GamePlayerOutcomeInput[]
    | readonly Partial<GamePlayerOutcomeInput>[]
    | undefined,
): GamePlayerOutcomeInput[] {
  const uniqueOutcomes = new Map<string, GamePlayerOutcomeInput>();

  for (const rawOutcome of value ?? []) {
    const playerId = normalizeText(rawOutcome.playerId);

    if (!playerId) {
      continue;
    }

    uniqueOutcomes.set(playerId, {
      playerId,
      finishPosition: normalizePositiveInteger(rawOutcome.finishPosition),
      eliminationOrder: normalizePositiveInteger(rawOutcome.eliminationOrder),
      eliminatedTurn: normalizePositiveInteger(rawOutcome.eliminatedTurn),
      lossReason: normalizeLossReason(rawOutcome.lossReason),
      lossDetail: normalizeText(rawOutcome.lossDetail),
      poisonCounters: normalizePositiveInteger(rawOutcome.poisonCounters),
      commanderDamageSource: normalizeText(rawOutcome.commanderDamageSource),
      commanderDamageAmount: normalizePositiveInteger(
        rawOutcome.commanderDamageAmount,
      ),
    });
  }

  return [...uniqueOutcomes.values()];
}

export function getPlayerOutcomeValidationError(
  outcomes: readonly GamePlayerOutcomeInput[],
) {
  const seenPlayerIds = new Set<string>();

  for (const outcome of outcomes) {
    if (!isUuid(outcome.playerId)) {
      return "Player outcomes must use valid player ids.";
    }

    if (seenPlayerIds.has(outcome.playerId)) {
      return "Each player can only have one outcome row.";
    }

    seenPlayerIds.add(outcome.playerId);

    if (
      hasInvalidPositiveNumber(outcome.finishPosition) ||
      hasInvalidPositiveNumber(outcome.eliminationOrder) ||
      hasInvalidPositiveNumber(outcome.eliminatedTurn) ||
      hasInvalidPositiveNumber(outcome.poisonCounters) ||
      hasInvalidPositiveNumber(outcome.commanderDamageAmount)
    ) {
      return "Finish, turn, poison, and commander damage values must be positive numbers.";
    }

    if (outcome.lossReason === "poison" && !outcome.poisonCounters) {
      return "Poison losses need a poison counter total.";
    }

    if (
      outcome.lossReason === "commander_damage" &&
      (!outcome.commanderDamageSource || !outcome.commanderDamageAmount)
    ) {
      return "Commander damage losses need a source and damage total.";
    }
  }

  return null;
}

export function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}

function normalizeLossReason(value: unknown): GameLossReason | null {
  const normalized = normalizeText(value);

  return gameLossReasons.includes(normalized as GameLossReason)
    ? (normalized as GameLossReason)
    : null;
}

function normalizePositiveInteger(value: unknown) {
  if (typeof value === "number") {
    return Number.isInteger(value) && value > 0 ? value : null;
  }

  const normalized = normalizeText(value);

  if (!normalized) {
    return null;
  }

  const parsed = Number(normalized);

  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function normalizeText(value: unknown) {
  if (Array.isArray(value)) {
    return normalizeText(value[0]);
  }

  return String(value ?? "").trim();
}

function uniqueNormalizedValues(values: readonly FormDataEntryValue[]) {
  const uniqueValues = new Set<string>();

  for (const value of values) {
    const normalized = normalizeText(value);

    if (normalized) {
      uniqueValues.add(normalized);
    }
  }

  return [...uniqueValues];
}

function hasInvalidPositiveNumber(value: number | null) {
  return value !== null && (!Number.isInteger(value) || value <= 0);
}

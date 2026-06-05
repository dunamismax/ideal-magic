import type { LogPodGameInput } from "@/features/games/game-form";
import { validateLogPodGameInput } from "@/features/games/game-form";

export type SavePodLifeGameInput = LogPodGameInput;

export type SavePodLifeGameValidationResult = ReturnType<
  typeof validateLogPodGameInput
>;

export function validateSavePodLifeGameInput(
  rawInput: Parameters<typeof validateLogPodGameInput>[0],
): SavePodLifeGameValidationResult {
  return validateLogPodGameInput(rawInput);
}

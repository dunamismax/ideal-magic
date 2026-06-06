"use server";

import { revalidatePath } from "next/cache";

import { createDatabase } from "@/db/client";
import {
  PodGameLoggingAuthorizationError,
  PodGameLoggingBlockedError,
  saveCompletedPodLifeCounterGame,
} from "@/db/queries/games";
import { requireServerSession } from "@/features/auth/server";
import {
  type SavePodLifeGameInput,
  validateSavePodLifeGameInput,
} from "@/features/life/pod-game-save";
import { readGamePlayerOutcomesFromFormData } from "@/features/games/player-outcomes";
import { assertSameOriginServerAction } from "@/features/security/csrf";
import { rateLimitPolicies } from "@/features/security/rate-limit";

export type SavePodLifeGameActionState = {
  message: string | null;
  saved: boolean;
  savedGameId: string | null;
  fieldErrors: Partial<Record<keyof SavePodLifeGameInput, string>>;
  fields: SavePodLifeGameInput;
};

export async function savePodLifeGameAction(
  _previousState: SavePodLifeGameActionState,
  formData: FormData,
): Promise<SavePodLifeGameActionState> {
  await assertSameOriginServerAction({
    rateLimit: rateLimitPolicies.write,
    scope: ["life", "pod", "save-game"],
  });

  const eventId = String(formData.get("eventId") ?? "");
  const podId = String(formData.get("podId") ?? "");
  const session = await requireServerSession(
    `/events/${eventId}/pods/${podId}/life`,
  );
  const fields: SavePodLifeGameInput = {
    eventId,
    podId,
    resultType: normalizeLifeGameResultType(formData.get("resultType")),
    winnerSeatIds: formData.getAll("winnerSeatIds").map(String),
    playerOutcomes: readGamePlayerOutcomesFromFormData(formData),
    notes: String(formData.get("notes") ?? ""),
  };
  const validation = validateSavePodLifeGameInput({
    eventId: fields.eventId,
    podId: fields.podId,
    resultType: String(formData.get("resultType") ?? ""),
    winnerSeatIds: fields.winnerSeatIds,
    playerOutcomes: fields.playerOutcomes,
    notes: fields.notes,
  });

  if (!validation.ok) {
    return {
      message: "Choose a valid game result.",
      saved: false,
      savedGameId: null,
      fieldErrors: validation.fieldErrors,
      fields: validation.fields,
    };
  }

  try {
    const logged = await saveCompletedPodLifeCounterGame(createDatabase(), {
      viewerUserId: session.user.id,
      ...validation.input,
    });

    revalidatePath("/game-night");
    revalidatePath("/history");
    revalidatePath(`/events/${eventId}/pods/${podId}/life`);

    return {
      message: `Saved ${logged.players.length}-player game to history.`,
      saved: true,
      savedGameId: logged.id,
      fieldErrors: {},
      fields: validation.input,
    };
  } catch (error) {
    if (error instanceof PodGameLoggingAuthorizationError) {
      return {
        message: "You cannot save a game from that pod.",
        saved: false,
        savedGameId: null,
        fieldErrors: {
          podId: "Choose one of your pod assignments.",
        },
        fields,
      };
    }

    if (error instanceof PodGameLoggingBlockedError) {
      return {
        message: error.message,
        saved: false,
        savedGameId: null,
        fieldErrors: {},
        fields,
      };
    }

    console.error("Pod life game save failed", error);

    return {
      message: "Could not save the game. Try again.",
      saved: false,
      savedGameId: null,
      fieldErrors: {},
      fields,
    };
  }
}

function normalizeLifeGameResultType(
  value: FormDataEntryValue | null,
): SavePodLifeGameInput["resultType"] {
  const resultType = String(value ?? "");

  switch (resultType) {
    case "combo_win":
    case "combat_win":
    case "concession":
    case "draw":
    case "time_called":
    case "unfinished":
    case "archenemy_win":
    case "team_win":
      return resultType;
    default:
      return "normal_win";
  }
}

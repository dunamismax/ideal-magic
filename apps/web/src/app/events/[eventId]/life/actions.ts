"use server";

import { revalidatePath } from "next/cache";

import { createDatabase } from "@/db/client";
import {
  EventGameLoggingAuthorizationError,
  EventGameLoggingBlockedError,
  saveCompletedEventLifeCounterGame,
} from "@/db/queries/games";
import { requireServerSession } from "@/features/auth/server";
import {
  type SaveEventLifeGameActionState,
  type SaveEventLifeGameInput,
  validateSaveEventLifeGameInput,
} from "@/features/life/event-game-save";
import { readGamePlayerOutcomesFromFormData } from "@/features/games/player-outcomes";
import { assertSameOriginServerAction } from "@/features/security/csrf";
import { rateLimitPolicies } from "@/features/security/rate-limit";

export async function saveEventLifeGameAction(
  _previousState: SaveEventLifeGameActionState,
  formData: FormData,
): Promise<SaveEventLifeGameActionState> {
  await assertSameOriginServerAction({
    rateLimit: rateLimitPolicies.write,
    scope: ["life", "event", "save-game"],
  });

  const eventId = String(formData.get("eventId") ?? "");
  const session = await requireServerSession(`/events/${eventId}/life`);
  const fields: SaveEventLifeGameInput = {
    eventId,
    resultType: normalizeLifeGameResultType(formData.get("resultType")),
    winnerParticipantIds: formData.getAll("winnerParticipantIds").map(String),
    playerOutcomes: readGamePlayerOutcomesFromFormData(formData),
    notes: String(formData.get("notes") ?? ""),
  };
  const validation = validateSaveEventLifeGameInput({
    eventId: fields.eventId,
    resultType: String(formData.get("resultType") ?? ""),
    winnerParticipantIds: fields.winnerParticipantIds,
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
    const logged = await saveCompletedEventLifeCounterGame(createDatabase(), {
      viewerUserId: session.user.id,
      ...validation.input,
    });

    revalidatePath("/game-night");
    revalidatePath("/history");
    revalidatePath(`/events/${eventId}/life`);

    return {
      message: `Saved ${logged.players.length}-player game to history.`,
      saved: true,
      savedGameId: logged.id,
      fieldErrors: {},
      fields: validation.input,
    };
  } catch (error) {
    if (error instanceof EventGameLoggingAuthorizationError) {
      return {
        message: "You cannot save a game from that event.",
        saved: false,
        savedGameId: null,
        fieldErrors: {
          eventId: "Choose one of your event counters.",
        },
        fields,
      };
    }

    if (error instanceof EventGameLoggingBlockedError) {
      return {
        message: error.message,
        saved: false,
        savedGameId: null,
        fieldErrors: {},
        fields,
      };
    }

    console.error("Event life game save failed", error);

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
): SaveEventLifeGameInput["resultType"] {
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

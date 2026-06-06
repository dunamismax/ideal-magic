"use server";

import { revalidatePath } from "next/cache";

import { createDatabase } from "@/db/client";
import {
  EventGameLoggingAuthorizationError,
  EventGameLoggingBlockedError,
  saveCompletedStandaloneLifeCounterGame,
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
import { trackAnalyticsEvent } from "@/lib/analytics";
import { logServerError } from "@/lib/logger";

export async function saveStandaloneLifeGameAction(
  _previousState: SaveEventLifeGameActionState,
  formData: FormData,
): Promise<SaveEventLifeGameActionState> {
  await assertSameOriginServerAction({
    rateLimit: rateLimitPolicies.write,
    scope: ["life", "standalone", "save-game"],
  });

  const eventId = String(formData.get("eventId") ?? "");
  const nextPath = eventId
    ? `/life?eventId=${encodeURIComponent(eventId)}`
    : "/life";
  const session = await requireServerSession(nextPath);
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
    const logged = await saveCompletedStandaloneLifeCounterGame(
      createDatabase(),
      {
        viewerUserId: session.user.id,
        ...validation.input,
      },
    );

    revalidatePath("/life");
    revalidatePath("/game-night");
    revalidatePath("/history");
    void trackAnalyticsEvent("standalone_life_game_saved");

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

    logServerError("standalone_life_game_save_failed", error, {
      component: "life",
    });

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

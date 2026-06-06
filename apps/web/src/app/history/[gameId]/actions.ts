"use server";

import { revalidatePath } from "next/cache";

import { createDatabase } from "@/db/client";
import {
  correctLoggedGameResultForViewer,
  GameResultCorrectionAuthorizationError,
  GameResultCorrectionBlockedError,
} from "@/db/queries/games";
import { requireServerSession } from "@/features/auth/server";
import {
  type CorrectGameResultInput,
  validateCorrectGameResultInput,
} from "@/features/games/game-form";
import { readGamePlayerOutcomesFromFormData } from "@/features/games/player-outcomes";
import { assertSameOriginServerAction } from "@/features/security/csrf";
import { rateLimitPolicies } from "@/features/security/rate-limit";

export type CorrectGameResultActionState = {
  message: string | null;
  saved: boolean;
  fieldErrors: Partial<Record<keyof CorrectGameResultInput, string>>;
  fields: CorrectGameResultInput;
};

export async function correctGameResultAction(
  _previousState: CorrectGameResultActionState,
  formData: FormData,
): Promise<CorrectGameResultActionState> {
  await assertSameOriginServerAction({
    rateLimit: rateLimitPolicies.write,
    scope: ["history", "game", "correct-result"],
  });

  const fields: CorrectGameResultInput = {
    gameId: String(formData.get("gameId") ?? ""),
    resultType: normalizeCorrectionResultType(formData.get("resultType")),
    winnerPlayerIds: formData.getAll("winnerPlayerIds").map(String),
    playerOutcomes: readGamePlayerOutcomesFromFormData(formData),
    notes: String(formData.get("notes") ?? ""),
  };
  const session = await requireServerSession(
    fields.gameId ? `/history/${fields.gameId}` : "/history",
  );
  const validation = validateCorrectGameResultInput({
    gameId: fields.gameId,
    resultType: String(formData.get("resultType") ?? ""),
    winnerPlayerIds: fields.winnerPlayerIds,
    playerOutcomes: fields.playerOutcomes,
    notes: fields.notes,
  });

  if (!validation.ok) {
    return {
      message: "Fix the highlighted fields.",
      saved: false,
      fieldErrors: validation.fieldErrors,
      fields: validation.fields,
    };
  }

  try {
    await correctLoggedGameResultForViewer(createDatabase(), {
      viewerUserId: session.user.id,
      ...validation.input,
    });

    revalidatePath("/history");
    revalidatePath(`/history/${validation.input.gameId}`);

    return {
      message: "Game result corrected.",
      saved: true,
      fieldErrors: {},
      fields: validation.input,
    };
  } catch (error) {
    if (error instanceof GameResultCorrectionAuthorizationError) {
      return {
        message: "You cannot correct that logged game.",
        saved: false,
        fieldErrors: {
          gameId: "Choose a game you managed or played in.",
        },
        fields,
      };
    }

    if (error instanceof GameResultCorrectionBlockedError) {
      return {
        message: error.message,
        saved: false,
        fieldErrors: {},
        fields,
      };
    }

    console.error("Game result correction failed", error);

    return {
      message: "Could not correct the game result. Try again.",
      saved: false,
      fieldErrors: {},
      fields,
    };
  }
}

function normalizeCorrectionResultType(
  value: FormDataEntryValue | null,
): CorrectGameResultInput["resultType"] {
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

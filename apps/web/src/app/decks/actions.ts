"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createDatabase } from "@/db/client";
import {
  createDeckForUser,
  DeckPlaygroupAuthorizationError,
} from "@/db/queries/decks";
import { requireServerSession } from "@/features/auth/server";
import {
  type CreateDeckInput,
  validateCreateDeckInput,
} from "@/features/decks/deck-form";

export type CreateDeckActionState = {
  message: string | null;
  fieldErrors: Partial<Record<keyof CreateDeckInput, string>>;
  fields: CreateDeckInput;
};

export async function createDeckAction(
  _previousState: CreateDeckActionState,
  formData: FormData,
): Promise<CreateDeckActionState> {
  const session = await requireServerSession("/decks");
  const validation = validateCreateDeckInput({
    name: formData.get("name") ?? "",
    commanders: formData.get("commanders") ?? "",
    colorIdentity: formData.get("colorIdentity") ?? "",
    bracket: formData.get("bracket") ?? "",
    powerEstimate: formData.get("powerEstimate") ?? "",
    archetype: formData.get("archetype") ?? "",
    tags: formData.get("tags") ?? "",
    visibility: formData.get("visibility") ?? "",
    playgroupId: formData.get("playgroupId") ?? "",
    externalUrl: formData.get("externalUrl") ?? "",
  });

  if (!validation.ok) {
    return {
      message: "Fix the highlighted deck fields.",
      fieldErrors: validation.fieldErrors,
      fields: validation.fields,
    };
  }

  try {
    await createDeckForUser(createDatabase(), {
      ownerUserId: session.user.id,
      ...validation.input,
    });
  } catch (error) {
    if (error instanceof DeckPlaygroupAuthorizationError) {
      return {
        message: "You cannot scope a deck to that playgroup.",
        fieldErrors: {
          playgroupId: "Choose one of your playgroups.",
        },
        fields: {
          ...validation.input,
          commanders: validation.input.commanders.join(", "),
          bracket: validation.input.bracket ?? "",
          powerEstimate: validation.input.powerEstimate?.toString() ?? "",
          tags: validation.input.tags.join(", "),
          playgroupId: validation.input.playgroupId ?? "",
          externalUrl: validation.input.externalUrl ?? "",
        },
      };
    }

    console.error("Deck creation failed", error);

    return {
      message: "Could not create the deck. Try again.",
      fieldErrors: {},
      fields: {
        ...validation.input,
        commanders: validation.input.commanders.join(", "),
        bracket: validation.input.bracket ?? "",
        powerEstimate: validation.input.powerEstimate?.toString() ?? "",
        tags: validation.input.tags.join(", "),
        playgroupId: validation.input.playgroupId ?? "",
        externalUrl: validation.input.externalUrl ?? "",
      },
    };
  }

  revalidatePath("/decks");
  revalidatePath("/game-night");
  redirect("/decks");
}

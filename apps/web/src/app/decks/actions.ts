"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createDatabase } from "@/db/client";
import {
  createDeckForUser,
  DeckOwnershipAuthorizationError,
  DeckPlaygroupAuthorizationError,
  retireDeckForUser,
  updateDeckForUser,
} from "@/db/queries/decks";
import { requireServerSession } from "@/features/auth/server";
import {
  type CreateDeckInput,
  type RetireDeckInput,
  type UpdateDeckInput,
  validateCreateDeckInput,
  validateRetireDeckInput,
  validateUpdateDeckInput,
} from "@/features/decks/deck-form";
import { assertSameOriginServerAction } from "@/features/security/csrf";
import { rateLimitPolicies } from "@/features/security/rate-limit";

export type CreateDeckActionState = {
  message: string | null;
  fieldErrors: Partial<Record<keyof CreateDeckInput, string>>;
  fields: CreateDeckInput;
};

export type UpdateDeckActionState = {
  message: string | null;
  fieldErrors: Partial<Record<keyof UpdateDeckInput, string>>;
  fields: UpdateDeckInput;
};

export type RetireDeckActionState = {
  message: string | null;
  fieldErrors: Partial<Record<keyof RetireDeckInput, string>>;
  fields: RetireDeckInput;
};

type NormalizedUpdateDeckInput = Omit<
  Parameters<typeof updateDeckForUser>[1],
  "ownerUserId"
>;

export async function createDeckAction(
  _previousState: CreateDeckActionState,
  formData: FormData,
): Promise<CreateDeckActionState> {
  await assertSameOriginServerAction({
    rateLimit: rateLimitPolicies.write,
    scope: ["decks", "create"],
  });

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

export async function updateDeckAction(
  _previousState: UpdateDeckActionState,
  formData: FormData,
): Promise<UpdateDeckActionState> {
  await assertSameOriginServerAction({
    rateLimit: rateLimitPolicies.write,
    scope: ["decks", "update"],
  });

  const session = await requireServerSession("/decks");
  const validation = validateUpdateDeckInput({
    deckId: formData.get("deckId") ?? "",
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
    const deck = await updateDeckForUser(createDatabase(), {
      ownerUserId: session.user.id,
      ...validation.input,
    });

    revalidatePath("/decks");
    revalidatePath("/game-night");

    return {
      message: "Deck updated.",
      fieldErrors: {},
      fields: fieldsFromUpdatedDeck(deck),
    };
  } catch (error) {
    if (error instanceof DeckPlaygroupAuthorizationError) {
      return {
        message: "You cannot scope a deck to that playgroup.",
        fieldErrors: {
          playgroupId: "Choose one of your playgroups.",
        },
        fields: fieldsFromValidUpdateInput(validation.input),
      };
    }

    if (error instanceof DeckOwnershipAuthorizationError) {
      return {
        message: "You cannot update that deck.",
        fieldErrors: {
          deckId: "Choose one of your active decks.",
        },
        fields: fieldsFromValidUpdateInput(validation.input),
      };
    }

    console.error("Deck update failed", error);

    return {
      message: "Could not update the deck. Try again.",
      fieldErrors: {},
      fields: fieldsFromValidUpdateInput(validation.input),
    };
  }
}

export async function retireDeckAction(
  _previousState: RetireDeckActionState,
  formData: FormData,
): Promise<RetireDeckActionState> {
  await assertSameOriginServerAction({
    rateLimit: rateLimitPolicies.write,
    scope: ["decks", "retire"],
  });

  const session = await requireServerSession("/decks");
  const validation = validateRetireDeckInput({
    deckId: formData.get("deckId") ?? "",
  });

  if (!validation.ok) {
    return {
      message: "Choose a valid deck to retire.",
      fieldErrors: validation.fieldErrors,
      fields: validation.fields,
    };
  }

  try {
    await retireDeckForUser(createDatabase(), {
      ownerUserId: session.user.id,
      deckId: validation.input.deckId,
    });
  } catch (error) {
    if (error instanceof DeckOwnershipAuthorizationError) {
      return {
        message: "You cannot retire that deck.",
        fieldErrors: {
          deckId: "Choose one of your active decks.",
        },
        fields: validation.input,
      };
    }

    console.error("Deck retirement failed", error);

    return {
      message: "Could not retire the deck. Try again.",
      fieldErrors: {},
      fields: validation.input,
    };
  }

  revalidatePath("/decks");
  revalidatePath("/game-night");
  redirect("/decks");
}

function fieldsFromValidUpdateInput(
  input: NormalizedUpdateDeckInput,
): UpdateDeckInput {
  return {
    deckId: input.deckId,
    name: input.name,
    commanders: input.commanders.join("\n"),
    colorIdentity: input.colorIdentity,
    bracket: input.bracket ?? "",
    powerEstimate:
      input.powerEstimate === null ? "" : input.powerEstimate.toString(),
    archetype: input.archetype,
    tags: input.tags.join(", "),
    visibility: input.visibility,
    playgroupId: input.playgroupId ?? "",
    externalUrl: input.externalUrl ?? "",
  };
}

function fieldsFromUpdatedDeck(
  deck: Awaited<ReturnType<typeof updateDeckForUser>>,
): UpdateDeckInput {
  return {
    deckId: deck.id,
    name: deck.name,
    commanders: deck.commanders.join("\n"),
    colorIdentity: deck.colorIdentity,
    bracket: deck.bracket ?? "",
    powerEstimate: deck.powerEstimate?.toString() ?? "",
    archetype: deck.archetype,
    tags: deck.tags.join(", "),
    visibility: deck.visibility,
    playgroupId: deck.playgroup?.id ?? "",
    externalUrl: deck.externalUrl ?? "",
  };
}

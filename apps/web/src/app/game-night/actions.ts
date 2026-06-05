"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createDatabase } from "@/db/client";
import {
  declareDeckForEvent,
  DeckDeclarationAuthorizationError,
  DeckDeclarationDuplicateError,
  undeclareDeckForEvent,
} from "@/db/queries/decks";
import {
  createEventForPlaygroup,
  EventCreationAuthorizationError,
  EventManagementAuthorizationError,
  EventRsvpAuthorizationError,
  setEventStatusForViewer,
  updateEventForViewer,
  upsertMemberRsvpForEvent,
} from "@/db/queries/event-planning";
import { requireServerSession } from "@/features/auth/server";
import {
  type CreateEventInput,
  type EventStatusInput,
  type UpdateEventInput,
  validateCreateEventInput,
  validateEventStatusInput,
  validateUpdateEventInput,
} from "@/features/events/event-form";
import {
  type MemberRsvpInput,
  validateMemberRsvpInput,
} from "@/features/events/member-rsvp";
import {
  type DeckDeclarationInput,
  type UndeclareDeckInput,
  validateDeckDeclarationInput,
  validateUndeclareDeckInput,
} from "@/features/decks/deck-form";

export type CreateEventActionState = {
  message: string | null;
  fieldErrors: Partial<Record<keyof CreateEventInput, string>>;
  fields: CreateEventInput;
};

export type UpdateMemberRsvpActionState = {
  message: string | null;
  saved: boolean;
  fieldErrors: Partial<Record<keyof MemberRsvpInput, string>>;
  fields: MemberRsvpInput;
};

export type UpdateEventActionState = {
  message: string | null;
  saved: boolean;
  fieldErrors: Partial<Record<keyof UpdateEventInput, string>>;
  fields: UpdateEventInput;
};

export type EventStatusActionState = {
  message: string | null;
  saved: boolean;
  fieldErrors: Partial<Record<keyof EventStatusInput, string>>;
  fields: EventStatusInput;
};

export type DeckDeclarationActionState = {
  message: string | null;
  saved: boolean;
  fieldErrors: Partial<Record<keyof DeckDeclarationInput, string>>;
  fields: DeckDeclarationInput;
};

export type UndeclareDeckActionState = {
  message: string | null;
  saved: boolean;
  fieldErrors: Partial<Record<keyof UndeclareDeckInput, string>>;
  fields: UndeclareDeckInput;
};

export async function createEventAction(
  _previousState: CreateEventActionState,
  formData: FormData,
): Promise<CreateEventActionState> {
  const session = await requireServerSession("/game-night");
  const validation = validateCreateEventInput({
    playgroupId: formData.get("playgroupId") ?? "",
    title: formData.get("title") ?? "",
    startsAt: formData.get("startsAt") ?? "",
    description: formData.get("description") ?? "",
    visibility: formData.get("visibility") ?? "",
  });

  if (!validation.ok) {
    return {
      message: "Fix the highlighted fields.",
      fieldErrors: validation.fieldErrors,
      fields: validation.fields,
    };
  }

  try {
    await createEventForPlaygroup(createDatabase(), {
      viewerUserId: session.user.id,
      ...validation.input,
    });
  } catch (error) {
    if (error instanceof EventCreationAuthorizationError) {
      return {
        message: "You cannot create events for that group.",
        fieldErrors: {
          playgroupId: "Choose one of your hostable groups.",
        },
        fields: {
          ...validation.input,
          startsAt: formData.get("startsAt")?.toString() ?? "",
        },
      };
    }

    console.error("Event creation failed", error);

    return {
      message: "Could not create the event. Try again.",
      fieldErrors: {},
      fields: {
        ...validation.input,
        startsAt: formData.get("startsAt")?.toString() ?? "",
      },
    };
  }

  revalidatePath("/game-night");
  revalidatePath("/groups");
  redirect("/game-night");
}

export async function updateMemberRsvpAction(
  _previousState: UpdateMemberRsvpActionState,
  formData: FormData,
): Promise<UpdateMemberRsvpActionState> {
  const session = await requireServerSession("/game-night");
  const validation = validateMemberRsvpInput({
    eventId: formData.get("eventId") ?? "",
    status: formData.get("status") ?? "",
    arrivalTime: formData.get("arrivalTime") ?? "",
    leavingTime: formData.get("leavingTime") ?? "",
  });

  if (!validation.ok) {
    return {
      message: "Fix the highlighted RSVP fields.",
      saved: false,
      fieldErrors: validation.fieldErrors,
      fields: validation.fields,
    };
  }

  try {
    await upsertMemberRsvpForEvent(createDatabase(), {
      viewerUserId: session.user.id,
      ...validation.input,
    });
  } catch (error) {
    if (error instanceof EventRsvpAuthorizationError) {
      return {
        message: "You cannot RSVP to that event.",
        saved: false,
        fieldErrors: {
          eventId: "Choose one of your group events.",
        },
        fields: validation.fields,
      };
    }

    console.error("Member RSVP failed", error);

    return {
      message: "Could not save your RSVP. Try again.",
      saved: false,
      fieldErrors: {},
      fields: validation.fields,
    };
  }

  revalidatePath("/game-night");

  return {
    message: "RSVP saved.",
    saved: true,
    fieldErrors: {},
    fields: validation.fields,
  };
}

export async function updateEventAction(
  _previousState: UpdateEventActionState,
  formData: FormData,
): Promise<UpdateEventActionState> {
  const session = await requireServerSession("/game-night");
  const validation = validateUpdateEventInput({
    eventId: formData.get("eventId") ?? "",
    title: formData.get("title") ?? "",
    startsAt: formData.get("startsAt") ?? "",
    description: formData.get("description") ?? "",
    visibility: formData.get("visibility") ?? "",
  });

  if (!validation.ok) {
    return {
      message: "Fix the highlighted event fields.",
      saved: false,
      fieldErrors: validation.fieldErrors,
      fields: validation.fields,
    };
  }

  try {
    await updateEventForViewer(createDatabase(), {
      viewerUserId: session.user.id,
      ...validation.input,
    });
  } catch (error) {
    if (error instanceof EventManagementAuthorizationError) {
      return {
        message: "You cannot edit that event.",
        saved: false,
        fieldErrors: {
          eventId: "Choose one of your hostable group events.",
        },
        fields: {
          ...validation.input,
          startsAt: formData.get("startsAt")?.toString() ?? "",
        },
      };
    }

    console.error("Event update failed", error);

    return {
      message: "Could not update the event. Try again.",
      saved: false,
      fieldErrors: {},
      fields: {
        ...validation.input,
        startsAt: formData.get("startsAt")?.toString() ?? "",
      },
    };
  }

  revalidatePath("/game-night");

  return {
    message: "Event updated.",
    saved: true,
    fieldErrors: {},
    fields: {
      ...validation.input,
      startsAt: formData.get("startsAt")?.toString() ?? "",
    },
  };
}

export async function updateEventStatusAction(
  _previousState: EventStatusActionState,
  formData: FormData,
): Promise<EventStatusActionState> {
  const session = await requireServerSession("/game-night");
  const validation = validateEventStatusInput({
    eventId: formData.get("eventId") ?? "",
    status: formData.get("status") ?? "",
  });

  if (!validation.ok) {
    return {
      message: "Choose a valid event action.",
      saved: false,
      fieldErrors: validation.fieldErrors,
      fields: validation.fields,
    };
  }

  try {
    await setEventStatusForViewer(createDatabase(), {
      viewerUserId: session.user.id,
      ...validation.input,
    });
  } catch (error) {
    if (error instanceof EventManagementAuthorizationError) {
      return {
        message: "You cannot manage that event.",
        saved: false,
        fieldErrors: {
          eventId: "Choose one of your hostable group events.",
        },
        fields: validation.input,
      };
    }

    console.error("Event status update failed", error);

    return {
      message: "Could not update event status. Try again.",
      saved: false,
      fieldErrors: {},
      fields: validation.input,
    };
  }

  revalidatePath("/game-night");

  return {
    message:
      validation.input.status === "cancelled"
        ? "Event cancelled."
        : "Event archived.",
    saved: true,
    fieldErrors: {},
    fields: validation.input,
  };
}

export async function declareDeckAction(
  _previousState: DeckDeclarationActionState,
  formData: FormData,
): Promise<DeckDeclarationActionState> {
  const session = await requireServerSession("/game-night");
  const fields: DeckDeclarationInput = {
    eventId: String(formData.get("eventId") ?? ""),
    deckId: String(formData.get("deckId") ?? ""),
    preference: String(formData.get("preference") ?? ""),
  };
  const validation = validateDeckDeclarationInput(fields);

  if (!validation.ok) {
    return {
      message: "Fix the highlighted deck declaration fields.",
      saved: false,
      fieldErrors: validation.fieldErrors,
      fields: validation.fields,
    };
  }

  try {
    await declareDeckForEvent(createDatabase(), {
      viewerUserId: session.user.id,
      ...validation.input,
    });
  } catch (error) {
    if (error instanceof DeckDeclarationAuthorizationError) {
      return {
        message: "You cannot declare that deck for this event.",
        saved: false,
        fieldErrors: {
          deckId: "Choose one of your decks for a scoped event.",
        },
        fields,
      };
    }

    if (error instanceof DeckDeclarationDuplicateError) {
      return {
        message: "That deck is already declared for this event.",
        saved: false,
        fieldErrors: {
          deckId: "Choose a different deck.",
        },
        fields,
      };
    }

    console.error("Deck declaration failed", error);

    return {
      message: "Could not declare the deck. Try again.",
      saved: false,
      fieldErrors: {},
      fields,
    };
  }

  revalidatePath("/game-night");

  return {
    message: "Deck declared.",
    saved: true,
    fieldErrors: {},
    fields,
  };
}

export async function undeclareDeckAction(
  _previousState: UndeclareDeckActionState,
  formData: FormData,
): Promise<UndeclareDeckActionState> {
  const session = await requireServerSession("/game-night");
  const fields: UndeclareDeckInput = {
    declarationId: String(formData.get("declarationId") ?? ""),
  };
  const validation = validateUndeclareDeckInput(fields);

  if (!validation.ok) {
    return {
      message: "Choose a valid deck declaration.",
      saved: false,
      fieldErrors: validation.fieldErrors,
      fields: validation.fields,
    };
  }

  try {
    await undeclareDeckForEvent(createDatabase(), {
      viewerUserId: session.user.id,
      declarationId: validation.input.declarationId,
    });
  } catch (error) {
    if (error instanceof DeckDeclarationAuthorizationError) {
      return {
        message: "You cannot remove that deck declaration.",
        saved: false,
        fieldErrors: {
          declarationId: "Choose one of your declarations.",
        },
        fields,
      };
    }

    console.error("Deck undeclaration failed", error);

    return {
      message: "Could not remove the deck declaration. Try again.",
      saved: false,
      fieldErrors: {},
      fields,
    };
  }

  revalidatePath("/game-night");

  return {
    message: "Deck undeclared.",
    saved: true,
    fieldErrors: {},
    fields,
  };
}

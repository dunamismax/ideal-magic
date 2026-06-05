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
import {
  logGameFromPublishedPod,
  PodGameLoggingAuthorizationError,
  PodGameLoggingBlockedError,
} from "@/db/queries/games";
import {
  type LogPodGameInput,
  validateLogPodGameInput,
} from "@/features/games/game-form";
import {
  generateDraftPodsForEvent,
  publishPodsForEventManager,
  PodGenerationAuthorizationError,
  PodGenerationBlockedByExistingPodsError,
  PodGenerationBlockedByLockedSeatsError,
  PodPublicationAuthorizationError,
  PodPublicationBlockedError,
  PodSeatLockAuthorizationError,
  PodSeatLockBlockedError,
  movePodSeatForEventManager,
  PodSeatMoveAuthorizationError,
  PodSeatMoveBlockedError,
  setPodSeatLockForEventManager,
  unpublishPodsForEventManager,
} from "@/db/queries/pods";
import {
  type GeneratePodsInput,
  type MovePodSeatInput,
  type PodPublicationInput,
  type PodSeatLockInput,
  validateGeneratePodsInput,
  validateMovePodSeatInput,
  validatePodPublicationInput,
  validatePodSeatLockInput,
} from "@/features/pods/pod-form";

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

export type GeneratePodsActionState = {
  message: string | null;
  saved: boolean;
  fieldErrors: Partial<Record<keyof GeneratePodsInput, string>>;
  fields: GeneratePodsInput;
};

export type MovePodSeatActionState = {
  message: string | null;
  saved: boolean;
  fieldErrors: Partial<Record<keyof MovePodSeatInput, string>>;
  fields: MovePodSeatInput;
};

export type PodSeatLockActionState = {
  message: string | null;
  saved: boolean;
  fieldErrors: Partial<Record<keyof PodSeatLockInput, string>>;
  fields: PodSeatLockInput;
};

export type PodPublicationActionState = {
  message: string | null;
  saved: boolean;
  fieldErrors: Partial<Record<keyof PodPublicationInput, string>>;
  fields: PodPublicationInput;
};

export type LogPodGameActionState = {
  message: string | null;
  saved: boolean;
  fieldErrors: Partial<Record<keyof LogPodGameInput, string>>;
  fields: LogPodGameInput;
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

export async function generatePodsAction(
  _previousState: GeneratePodsActionState,
  formData: FormData,
): Promise<GeneratePodsActionState> {
  const session = await requireServerSession("/game-night");
  const fields: GeneratePodsInput = {
    eventId: String(formData.get("eventId") ?? ""),
  };
  const validation = validateGeneratePodsInput(fields);

  if (!validation.ok) {
    return {
      message: "Choose a valid event.",
      saved: false,
      fieldErrors: validation.fieldErrors,
      fields: validation.fields,
    };
  }

  try {
    const generatedPods = await generateDraftPodsForEvent(createDatabase(), {
      viewerUserId: session.user.id,
      eventId: validation.input.eventId,
    });

    revalidatePath("/game-night");

    return {
      message:
        generatedPods.length > 0
          ? `Generated ${generatedPods.length} draft pod${generatedPods.length === 1 ? "" : "s"}.`
          : "No eligible yes or maybe RSVPs to seat.",
      saved: true,
      fieldErrors: {},
      fields,
    };
  } catch (error) {
    if (error instanceof PodGenerationAuthorizationError) {
      return {
        message: "You cannot generate pods for that event.",
        saved: false,
        fieldErrors: {
          eventId: "Choose one of your hostable group events.",
        },
        fields,
      };
    }

    if (error instanceof PodGenerationBlockedByExistingPodsError) {
      return {
        message: "Existing non-draft pods must be managed before regenerating.",
        saved: false,
        fieldErrors: {},
        fields,
      };
    }

    if (error instanceof PodGenerationBlockedByLockedSeatsError) {
      return {
        message: error.message,
        saved: false,
        fieldErrors: {},
        fields,
      };
    }

    console.error("Pod generation failed", error);

    return {
      message: "Could not generate pods. Try again.",
      saved: false,
      fieldErrors: {},
      fields,
    };
  }
}

export async function movePodSeatAction(
  _previousState: MovePodSeatActionState,
  formData: FormData,
): Promise<MovePodSeatActionState> {
  const session = await requireServerSession("/game-night");
  const fields: MovePodSeatInput = {
    eventId: String(formData.get("eventId") ?? ""),
    seatId: String(formData.get("seatId") ?? ""),
    targetPodId: String(formData.get("targetPodId") ?? ""),
    targetSeatPosition: Number(formData.get("targetSeatPosition") ?? ""),
  };
  const validation = validateMovePodSeatInput(fields);

  if (!validation.ok) {
    return {
      message: "Choose a valid pod and seat.",
      saved: false,
      fieldErrors: validation.fieldErrors,
      fields: validation.fields,
    };
  }

  try {
    const pods = await movePodSeatForEventManager(createDatabase(), {
      viewerUserId: session.user.id,
      eventId: validation.input.eventId,
      seatId: validation.input.seatId,
      targetPodId: validation.input.targetPodId,
      targetSeatPosition: validation.input.targetSeatPosition,
    });
    const targetPod = pods.find(
      (pod) => pod.id === validation.input.targetPodId,
    );
    const movedSeat = targetPod?.seats.find(
      (seat) => seat.id === validation.input.seatId,
    );

    revalidatePath("/game-night");

    return {
      message:
        targetPod && movedSeat
          ? `Moved ${movedSeat.participantName} to ${targetPod.name} seat ${movedSeat.seatPosition}.`
          : "Pod seat moved.",
      saved: true,
      fieldErrors: {},
      fields,
    };
  } catch (error) {
    if (error instanceof PodSeatMoveAuthorizationError) {
      return {
        message: "You cannot move seats for that event.",
        saved: false,
        fieldErrors: {
          eventId: "Choose one of your managed events.",
        },
        fields,
      };
    }

    if (error instanceof PodSeatMoveBlockedError) {
      return {
        message: error.message,
        saved: false,
        fieldErrors: {},
        fields,
      };
    }

    console.error("Pod seat movement failed", error);

    return {
      message: "Could not move the pod seat. Try again.",
      saved: false,
      fieldErrors: {},
      fields,
    };
  }
}

export async function updatePodSeatLockAction(
  _previousState: PodSeatLockActionState,
  formData: FormData,
): Promise<PodSeatLockActionState> {
  const session = await requireServerSession("/game-night");
  const fields: PodSeatLockInput = {
    eventId: String(formData.get("eventId") ?? ""),
    seatId: String(formData.get("seatId") ?? ""),
    intent:
      String(formData.get("intent") ?? "") === "unlock" ? "unlock" : "lock",
  };
  const validation = validatePodSeatLockInput({
    eventId: fields.eventId,
    seatId: fields.seatId,
    intent: String(formData.get("intent") ?? ""),
  });

  if (!validation.ok) {
    return {
      message: "Choose a valid seat lock action.",
      saved: false,
      fieldErrors: validation.fieldErrors,
      fields: validation.fields,
    };
  }

  try {
    const pods = await setPodSeatLockForEventManager(createDatabase(), {
      viewerUserId: session.user.id,
      eventId: validation.input.eventId,
      seatId: validation.input.seatId,
      locked: validation.input.intent === "lock",
    });
    const seat = pods
      .flatMap((pod) => pod.seats)
      .find((entry) => entry.id === validation.input.seatId);

    revalidatePath("/game-night");

    return {
      message:
        validation.input.intent === "lock"
          ? `Locked ${seat?.participantName ?? "seat"}.`
          : `Unlocked ${seat?.participantName ?? "seat"}.`,
      saved: true,
      fieldErrors: {},
      fields: validation.input,
    };
  } catch (error) {
    if (error instanceof PodSeatLockAuthorizationError) {
      return {
        message: "You cannot lock seats for that event.",
        saved: false,
        fieldErrors: {
          eventId: "Choose one of your managed events.",
        },
        fields: validation.input,
      };
    }

    if (error instanceof PodSeatLockBlockedError) {
      return {
        message: error.message,
        saved: false,
        fieldErrors: {},
        fields: validation.input,
      };
    }

    console.error("Pod seat lock update failed", error);

    return {
      message: "Could not update the seat lock. Try again.",
      saved: false,
      fieldErrors: {},
      fields: validation.input,
    };
  }
}

export async function updatePodPublicationAction(
  _previousState: PodPublicationActionState,
  formData: FormData,
): Promise<PodPublicationActionState> {
  const session = await requireServerSession("/game-night");
  const fields: PodPublicationInput = {
    eventId: String(formData.get("eventId") ?? ""),
    intent:
      String(formData.get("intent") ?? "") === "unpublish"
        ? "unpublish"
        : "publish",
  };
  const validation = validatePodPublicationInput({
    eventId: fields.eventId,
    intent: String(formData.get("intent") ?? ""),
  });

  if (!validation.ok) {
    return {
      message: "Choose a valid pod publication action.",
      saved: false,
      fieldErrors: validation.fieldErrors,
      fields: validation.fields,
    };
  }

  try {
    if (validation.input.intent === "publish") {
      await publishPodsForEventManager(createDatabase(), {
        viewerUserId: session.user.id,
        eventId: validation.input.eventId,
      });
    } else {
      await unpublishPodsForEventManager(createDatabase(), {
        viewerUserId: session.user.id,
        eventId: validation.input.eventId,
      });
    }

    revalidatePath("/game-night");

    return {
      message:
        validation.input.intent === "publish"
          ? "Pod assignments published."
          : "Pod assignments returned to draft.",
      saved: true,
      fieldErrors: {},
      fields: validation.input,
    };
  } catch (error) {
    if (error instanceof PodPublicationAuthorizationError) {
      return {
        message: "You cannot publish pods for that event.",
        saved: false,
        fieldErrors: {
          eventId: "Choose one of your managed events.",
        },
        fields: validation.input,
      };
    }

    if (error instanceof PodPublicationBlockedError) {
      return {
        message: error.message,
        saved: false,
        fieldErrors: {},
        fields: validation.input,
      };
    }

    console.error("Pod publication failed", error);

    return {
      message: "Could not update pod publication. Try again.",
      saved: false,
      fieldErrors: {},
      fields: validation.input,
    };
  }
}

export async function logPodGameAction(
  _previousState: LogPodGameActionState,
  formData: FormData,
): Promise<LogPodGameActionState> {
  const session = await requireServerSession("/game-night");
  const fields: LogPodGameInput = {
    eventId: String(formData.get("eventId") ?? ""),
    podId: String(formData.get("podId") ?? ""),
    resultType:
      String(formData.get("resultType") ?? "") === "draw"
        ? "draw"
        : String(formData.get("resultType") ?? "") === "time_called"
          ? "time_called"
          : String(formData.get("resultType") ?? "") === "unfinished"
            ? "unfinished"
            : "normal_win",
    winnerSeatId: String(formData.get("winnerSeatId") ?? ""),
    notes: String(formData.get("notes") ?? ""),
  };
  const validation = validateLogPodGameInput({
    eventId: fields.eventId,
    podId: fields.podId,
    resultType: String(formData.get("resultType") ?? ""),
    winnerSeatId: fields.winnerSeatId,
    notes: fields.notes,
  });

  if (!validation.ok) {
    return {
      message: "Choose a valid game result.",
      saved: false,
      fieldErrors: validation.fieldErrors,
      fields: validation.fields,
    };
  }

  try {
    const logged = await logGameFromPublishedPod(createDatabase(), {
      viewerUserId: session.user.id,
      ...validation.input,
    });

    revalidatePath("/game-night");

    return {
      message: `Logged ${logged.players.length}-player game.`,
      saved: true,
      fieldErrors: {},
      fields,
    };
  } catch (error) {
    if (error instanceof PodGameLoggingAuthorizationError) {
      return {
        message: "You cannot log a game from that pod.",
        saved: false,
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
        fieldErrors: {},
        fields,
      };
    }

    console.error("Pod game logging failed", error);

    return {
      message: "Could not log the pod game. Try again.",
      saved: false,
      fieldErrors: {},
      fields,
    };
  }
}

"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createDatabase } from "@/db/client";
import {
  createEventForPlaygroup,
  EventCreationAuthorizationError,
  EventRsvpAuthorizationError,
  upsertMemberRsvpForEvent,
} from "@/db/queries/event-planning";
import { requireServerSession } from "@/features/auth/server";
import {
  type CreateEventInput,
  validateCreateEventInput,
} from "@/features/events/event-form";
import {
  type MemberRsvpInput,
  validateMemberRsvpInput,
} from "@/features/events/member-rsvp";

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

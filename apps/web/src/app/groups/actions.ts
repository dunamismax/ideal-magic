"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createDatabase } from "@/db/client";
import {
  createPlaygroupForUser,
  createPlaygroupInviteForViewer,
  PlaygroupInviteAuthorizationError,
  revokePlaygroupInviteForViewer,
} from "@/db/queries/playgroups";
import { requireServerSession } from "@/features/auth/server";
import {
  type CreateGroupInput,
  validateCreateGroupInput,
} from "@/features/groups/group-form";
import {
  type CreateGroupInviteInput,
  type RevokeGroupInviteInput,
  validateCreateGroupInviteInput,
  validateRevokeGroupInviteInput,
} from "@/features/groups/group-invite";

export type CreateGroupActionState = {
  message: string | null;
  fieldErrors: Partial<Record<keyof CreateGroupInput, string>>;
  fields: CreateGroupInput;
};

export type CreateGroupInviteActionState = {
  message: string | null;
  saved: boolean;
  fieldErrors: Partial<Record<keyof CreateGroupInviteInput, string>>;
  fields: CreateGroupInviteInput;
  createdInvite: {
    playgroupId: string;
    inviteToken: string;
  } | null;
};

export type RevokeGroupInviteActionState = {
  message: string | null;
  saved: boolean;
  fieldErrors: Partial<Record<keyof RevokeGroupInviteInput, string>>;
  fields: RevokeGroupInviteInput;
};

export async function createGroupAction(
  _previousState: CreateGroupActionState,
  formData: FormData,
): Promise<CreateGroupActionState> {
  const session = await requireServerSession("/groups");
  const validation = validateCreateGroupInput({
    name: formData.get("name") ?? "",
    description: formData.get("description") ?? "",
  });

  if (!validation.ok) {
    return {
      message: "Fix the highlighted fields.",
      fieldErrors: validation.fieldErrors,
      fields: validation.fields,
    };
  }

  try {
    await createPlaygroupForUser(createDatabase(), {
      userId: session.user.id,
      ownerDisplayName: session.user.name,
      ...validation.input,
    });
  } catch (error) {
    console.error("Playgroup creation failed", error);

    return {
      message: "Could not create the group. Try again.",
      fieldErrors: {},
      fields: {
        name: validation.input.name,
        description: validation.input.description,
      },
    };
  }

  revalidatePath("/groups");
  redirect("/groups");
}

export async function createGroupInviteAction(
  _previousState: CreateGroupInviteActionState,
  formData: FormData,
): Promise<CreateGroupInviteActionState> {
  const session = await requireServerSession("/groups");
  const validation = validateCreateGroupInviteInput({
    playgroupId: formData.get("playgroupId") ?? "",
  });

  if (!validation.ok) {
    return {
      message: "Choose one of your manageable groups.",
      saved: false,
      fieldErrors: validation.fieldErrors,
      fields: validation.fields,
      createdInvite: null,
    };
  }

  try {
    const invite = await createPlaygroupInviteForViewer(createDatabase(), {
      viewerUserId: session.user.id,
      playgroupId: validation.input.playgroupId,
    });

    revalidatePath("/groups");

    return {
      message: "Invite created.",
      saved: true,
      fieldErrors: {},
      fields: validation.input,
      createdInvite: {
        playgroupId: invite.playgroupId,
        inviteToken: invite.inviteToken,
      },
    };
  } catch (error) {
    if (error instanceof PlaygroupInviteAuthorizationError) {
      return {
        message: "You cannot create invites for that group.",
        saved: false,
        fieldErrors: {
          playgroupId: "Choose one of your manageable groups.",
        },
        fields: validation.input,
        createdInvite: null,
      };
    }

    console.error("Playgroup invite creation failed", error);

    return {
      message: "Could not create the invite. Try again.",
      saved: false,
      fieldErrors: {},
      fields: validation.input,
      createdInvite: null,
    };
  }
}

export async function revokeGroupInviteAction(
  _previousState: RevokeGroupInviteActionState,
  formData: FormData,
): Promise<RevokeGroupInviteActionState> {
  const session = await requireServerSession("/groups");
  const validation = validateRevokeGroupInviteInput({
    inviteId: formData.get("inviteId") ?? "",
  });

  if (!validation.ok) {
    return {
      message: "Choose a valid invite.",
      saved: false,
      fieldErrors: validation.fieldErrors,
      fields: validation.fields,
    };
  }

  try {
    await revokePlaygroupInviteForViewer(createDatabase(), {
      viewerUserId: session.user.id,
      inviteId: validation.input.inviteId,
    });
  } catch (error) {
    if (error instanceof PlaygroupInviteAuthorizationError) {
      return {
        message: "You cannot revoke that invite.",
        saved: false,
        fieldErrors: {
          inviteId: "Choose one of your group invites.",
        },
        fields: validation.input,
      };
    }

    console.error("Playgroup invite revocation failed", error);

    return {
      message: "Could not revoke the invite. Try again.",
      saved: false,
      fieldErrors: {},
      fields: validation.input,
    };
  }

  revalidatePath("/groups");

  return {
    message: "Invite revoked.",
    saved: true,
    fieldErrors: {},
    fields: validation.input,
  };
}

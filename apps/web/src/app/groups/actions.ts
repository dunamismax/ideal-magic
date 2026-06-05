"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createDatabase } from "@/db/client";
import {
  changePlaygroupMemberRoleForViewer,
  createPlaygroupForUser,
  createPlaygroupInviteForViewer,
  PlaygroupLastOwnerError,
  PlaygroupMemberManagementAuthorizationError,
  PlaygroupInviteAuthorizationError,
  removePlaygroupMemberForViewer,
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
import {
  type ChangeGroupMemberRoleInput,
  type RemoveGroupMemberInput,
  validateChangeGroupMemberRoleInput,
  validateRemoveGroupMemberInput,
} from "@/features/groups/group-member-management";
import { assertSameOriginServerAction } from "@/features/security/csrf";
import { rateLimitPolicies } from "@/features/security/rate-limit";

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

export type ChangeGroupMemberRoleActionState = {
  message: string | null;
  saved: boolean;
  fieldErrors: Partial<Record<keyof ChangeGroupMemberRoleInput, string>>;
  fields: ChangeGroupMemberRoleInput;
};

export type RemoveGroupMemberActionState = {
  message: string | null;
  saved: boolean;
  fieldErrors: Partial<Record<keyof RemoveGroupMemberInput, string>>;
  fields: RemoveGroupMemberInput;
};

export async function createGroupAction(
  _previousState: CreateGroupActionState,
  formData: FormData,
): Promise<CreateGroupActionState> {
  await assertSameOriginServerAction({
    rateLimit: rateLimitPolicies.write,
    scope: ["groups", "create"],
  });

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
  await assertSameOriginServerAction({
    rateLimit: rateLimitPolicies.invite,
    scope: ["groups", "invite", "create"],
  });

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
  await assertSameOriginServerAction({
    rateLimit: rateLimitPolicies.invite,
    scope: ["groups", "invite", "revoke"],
  });

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

export async function changeGroupMemberRoleAction(
  _previousState: ChangeGroupMemberRoleActionState,
  formData: FormData,
): Promise<ChangeGroupMemberRoleActionState> {
  await assertSameOriginServerAction({
    rateLimit: rateLimitPolicies.write,
    scope: ["groups", "members", "role"],
  });

  const session = await requireServerSession("/groups");
  const validation = validateChangeGroupMemberRoleInput({
    membershipId: formData.get("membershipId") ?? "",
    role: formData.get("role") ?? "",
  });

  if (!validation.ok) {
    return {
      message: "Choose a valid member role.",
      saved: false,
      fieldErrors: validation.fieldErrors,
      fields: {
        membershipId: validation.fields.membershipId,
        role: "member",
      },
    };
  }

  try {
    await changePlaygroupMemberRoleForViewer(createDatabase(), {
      viewerUserId: session.user.id,
      membershipId: validation.input.membershipId,
      role: validation.input.role,
    });
  } catch (error) {
    if (error instanceof PlaygroupLastOwnerError) {
      return {
        message: "A group must keep at least one owner.",
        saved: false,
        fieldErrors: {
          membershipId: "Keep one owner before changing this role.",
        },
        fields: validation.input,
      };
    }

    if (error instanceof PlaygroupMemberManagementAuthorizationError) {
      return {
        message: "You cannot change that member role.",
        saved: false,
        fieldErrors: {
          membershipId: "Choose one of your manageable group members.",
        },
        fields: validation.input,
      };
    }

    console.error("Playgroup member role change failed", error);

    return {
      message: "Could not update the member role. Try again.",
      saved: false,
      fieldErrors: {},
      fields: validation.input,
    };
  }

  revalidatePath("/groups");

  return {
    message: "Member role updated.",
    saved: true,
    fieldErrors: {},
    fields: validation.input,
  };
}

export async function removeGroupMemberAction(
  _previousState: RemoveGroupMemberActionState,
  formData: FormData,
): Promise<RemoveGroupMemberActionState> {
  await assertSameOriginServerAction({
    rateLimit: rateLimitPolicies.write,
    scope: ["groups", "members", "remove"],
  });

  const session = await requireServerSession("/groups");
  const validation = validateRemoveGroupMemberInput({
    membershipId: formData.get("membershipId") ?? "",
  });

  if (!validation.ok) {
    return {
      message: "Choose a valid member.",
      saved: false,
      fieldErrors: validation.fieldErrors,
      fields: validation.fields,
    };
  }

  try {
    await removePlaygroupMemberForViewer(createDatabase(), {
      viewerUserId: session.user.id,
      membershipId: validation.input.membershipId,
    });
  } catch (error) {
    if (error instanceof PlaygroupLastOwnerError) {
      return {
        message: "A group must keep at least one owner.",
        saved: false,
        fieldErrors: {
          membershipId: "Keep one owner before removing this member.",
        },
        fields: validation.input,
      };
    }

    if (error instanceof PlaygroupMemberManagementAuthorizationError) {
      return {
        message: "You cannot remove that member.",
        saved: false,
        fieldErrors: {
          membershipId: "Choose one of your manageable group members.",
        },
        fields: validation.input,
      };
    }

    console.error("Playgroup member removal failed", error);

    return {
      message: "Could not remove the member. Try again.",
      saved: false,
      fieldErrors: {},
      fields: validation.input,
    };
  }

  revalidatePath("/groups");

  return {
    message: "Member removed from group.",
    saved: true,
    fieldErrors: {},
    fields: validation.input,
  };
}

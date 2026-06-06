"use server";

import { redirect } from "next/navigation";

import { createDatabase } from "@/db/client";
import {
  acceptPlaygroupInviteForViewer,
  PlaygroupInviteAcceptanceError,
} from "@/db/queries/playgroups";
import { requireServerSession } from "@/features/auth/server";
import { assertSameOriginServerAction } from "@/features/security/csrf";
import { rateLimitPolicies } from "@/features/security/rate-limit";
import { logServerError } from "@/lib/logger";

export async function acceptGroupInviteAction(formData: FormData) {
  const inviteToken = String(formData.get("inviteToken") ?? "").trim();

  await assertSameOriginServerAction({
    rateLimit: rateLimitPolicies.invite,
    scope: ["groups", "invite", "accept", inviteToken],
  });

  const session = await requireServerSession(`/invites/groups/${inviteToken}`);

  try {
    await acceptPlaygroupInviteForViewer(createDatabase(), {
      viewerUserId: session.user.id,
      inviteToken,
      displayName: session.user.name,
    });
  } catch (error) {
    if (error instanceof PlaygroupInviteAcceptanceError) {
      redirect(`/invites/groups/${inviteToken}?error=unavailable`);
    }

    logServerError("playgroup_invite_acceptance_failed", error, {
      component: "groups",
    });
    redirect(`/invites/groups/${inviteToken}?error=failed`);
  }

  redirect("/groups");
}

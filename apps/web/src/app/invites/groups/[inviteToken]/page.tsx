import { LogIn, UserPlus, UsersRound } from "lucide-react";
import Link from "next/link";

import { PageFrame } from "@/components/page-frame";
import { Button } from "@/components/ui/button";
import { createDatabase } from "@/db/client";
import { getLoginRedirectPath, getServerSession } from "@/features/auth/server";
import { getPlaygroupInviteSummaryByToken } from "@/db/queries/playgroups";
import { acceptGroupInviteAction } from "./actions";

export const dynamic = "force-dynamic";

export default async function GroupInvitePage({
  params,
  searchParams,
}: {
  params: Promise<{ inviteToken: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const [{ inviteToken }, { error }] = await Promise.all([
    params,
    searchParams,
  ]);
  const invite = await getPlaygroupInviteSummaryByToken(createDatabase(), {
    inviteToken,
  });
  const session = await getServerSession();
  const nextPath = `/invites/groups/${inviteToken}`;

  return (
    <PageFrame eyebrow="Group invite" title="Join Playgroup">
      <div className="max-w-xl rounded-panel border border-border bg-surface p-4 shadow-sm sm:p-5">
        {invite?.isActive ? (
          <div className="grid gap-4">
            <div className="flex items-start gap-3">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-control bg-accent text-accent-foreground">
                <UsersRound className="size-5" aria-hidden="true" />
              </span>
              <div>
                <h2 className="text-xl font-bold">{invite.playgroup.name}</h2>
                <p className="mt-1 text-sm font-semibold text-muted">
                  /groups/{invite.playgroup.slug}
                </p>
              </div>
            </div>

            {error ? (
              <p className="rounded-control border border-danger/40 bg-danger/10 p-3 text-sm font-semibold text-danger">
                {error === "unavailable"
                  ? "That invite is no longer available."
                  : "Could not accept that invite. Try again."}
              </p>
            ) : null}

            {session ? (
              <form action={acceptGroupInviteAction}>
                <input name="inviteToken" type="hidden" value={inviteToken} />
                <Button type="submit" variant="primary">
                  <UserPlus className="size-4" aria-hidden="true" />
                  Join Group
                </Button>
              </form>
            ) : (
              <div className="flex flex-col gap-3 sm:flex-row">
                <Button asChild variant="primary">
                  <Link href={getLoginRedirectPath(nextPath)}>
                    <LogIn className="size-4" aria-hidden="true" />
                    Log In
                  </Link>
                </Button>
                <Button asChild>
                  <Link href={`/signup?next=${encodeURIComponent(nextPath)}`}>
                    <UserPlus className="size-4" aria-hidden="true" />
                    Create Account
                  </Link>
                </Button>
              </div>
            )}
          </div>
        ) : (
          <div className="grid gap-3">
            <h2 className="text-xl font-bold">Invite unavailable</h2>
            <p className="text-sm font-semibold text-muted">
              Ask a group owner or admin for a fresh invite.
            </p>
          </div>
        )}
      </div>
    </PageFrame>
  );
}

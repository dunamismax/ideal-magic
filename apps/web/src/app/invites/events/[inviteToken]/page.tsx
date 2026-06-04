import { PageFrame } from "@/components/page-frame";
import { PublicEventInviteClient } from "./public-event-invite-client";

export default async function PublicEventInvitePage({
  params,
}: {
  params: Promise<{ inviteToken: string }>;
}) {
  const { inviteToken } = await params;

  return (
    <PageFrame eyebrow="Event invite" title="Commander Night">
      <PublicEventInviteClient inviteToken={inviteToken} />
    </PageFrame>
  );
}

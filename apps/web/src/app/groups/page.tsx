import { CalendarDays, ShieldCheck, UserRound, UsersRound } from "lucide-react";

import { PageFrame } from "@/components/page-frame";
import { EmptyState } from "@/components/ui/empty-state";
import { createDatabase } from "@/db/client";
import {
  listPlaygroupsForViewer,
  type ViewerPlaygroupListItem,
} from "@/db/queries/playgroups";
import { requireServerSession } from "@/features/auth/server";
import { CreateGroupForm } from "./create-group-form";
import { GroupInvitePanel } from "./group-invite-panel";
import { GroupMemberManagementPanel } from "./group-member-management-panel";

export const dynamic = "force-dynamic";

export default async function GroupsPage() {
  const session = await requireServerSession("/groups");
  const groups = await listPlaygroupsForViewer(createDatabase(), {
    viewerUserId: session.user.id,
  });

  return (
    <PageFrame eyebrow="Playgroups" title="Groups">
      <div className="grid gap-4 xl:grid-cols-[0.8fr_1.2fr]">
        <CreateGroupForm />

        <section className="grid gap-3">
          {groups.length > 0 ? (
            groups.map((group) => <GroupCard group={group} key={group.id} />)
          ) : (
            <EmptyState icon={UsersRound} title="No groups yet" />
          )}
        </section>
      </div>
    </PageFrame>
  );
}

export function GroupCard({ group }: { group: ViewerPlaygroupListItem }) {
  return (
    <article className="rounded-panel border border-border bg-surface p-4 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-lg font-bold">{group.name}</h2>
          <p className="mt-1 text-sm font-semibold text-muted">
            /groups/{group.slug}
          </p>
          {group.description ? (
            <p className="mt-3 text-sm font-medium text-muted">
              {group.description}
            </p>
          ) : null}
        </div>
        <span className="inline-flex w-fit items-center gap-1.5 rounded-control border border-border bg-background px-2 py-1 text-xs font-bold uppercase text-muted">
          <ShieldCheck className="size-3.5 text-accent" aria-hidden="true" />
          {group.role}
        </span>
      </div>

      <dl className="mt-4 grid gap-2 sm:grid-cols-2">
        <Metric
          icon={UsersRound}
          label="Members"
          value={String(group.memberCount)}
        />
        <Metric
          icon={CalendarDays}
          label="Upcoming Events"
          value={String(group.upcomingEventCount)}
        />
      </dl>

      {group.members.length > 0 ? (
        <section
          aria-labelledby={`group-${group.id}-members`}
          className="mt-4 rounded-control border border-border bg-background p-3"
        >
          <h3
            className="flex items-center gap-2 text-xs font-bold uppercase text-muted"
            id={`group-${group.id}-members`}
          >
            <UserRound className="size-4 text-accent" aria-hidden="true" />
            Member Directory
          </h3>
          <ul className="mt-3 grid gap-2 sm:grid-cols-2">
            {group.members.map((member) => (
              <li
                className="min-w-0 rounded-control border border-border bg-surface px-3 py-2"
                key={member.id}
              >
                <div className="flex min-w-0 items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold">
                      {member.displayName}
                    </p>
                    <p className="text-xs font-semibold text-muted">
                      Joined {formatJoinedDate(member.joinedAt)}
                    </p>
                  </div>
                  <span className="shrink-0 rounded-control border border-border bg-background px-2 py-1 text-xs font-bold uppercase text-muted">
                    {member.role}
                  </span>
                </div>
                {group.canManagePlaygroup ? (
                  <GroupMemberManagementPanel
                    member={member}
                    viewerRole={group.role}
                  />
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {group.canManagePlaygroup ? (
        <GroupInvitePanel
          groupId={group.id}
          groupName={group.name}
          invites={group.invites}
        />
      ) : null}
    </article>
  );
}

function Metric({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof UsersRound;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-control border border-border bg-background p-3">
      <dt className="flex items-center gap-2 text-xs font-bold uppercase text-muted">
        <Icon className="size-4 text-accent" aria-hidden="true" />
        {label}
      </dt>
      <dd className="mt-1 text-xl font-black">{value}</dd>
    </div>
  );
}

function formatJoinedDate(date: Date) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

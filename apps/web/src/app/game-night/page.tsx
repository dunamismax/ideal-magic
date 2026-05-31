import { CalendarDays, type LucideIcon, UsersRound } from "lucide-react";

import { PageFrame } from "@/components/page-frame";

export default function GameNightPage() {
  return (
    <PageFrame title="Game Night">
      <div className="grid gap-3 lg:grid-cols-2">
        <Panel
          icon={CalendarDays}
          title="Next Event"
          value="Tonight, 7:00 PM"
        />
        <Panel icon={UsersRound} title="RSVPs" value="7 yes, 2 maybe" />
      </div>
    </PageFrame>
  );
}

function Panel({
  icon: Icon,
  title,
  value,
}: {
  icon: LucideIcon;
  title: string;
  value: string;
}) {
  return (
    <div className="rounded-control border border-border bg-background p-4">
      <Icon className="mb-4 size-5 text-accent" aria-hidden="true" />
      <h2 className="text-sm font-bold uppercase tracking-wide text-muted">
        {title}
      </h2>
      <p className="mt-1 text-2xl font-black">{value}</p>
    </div>
  );
}

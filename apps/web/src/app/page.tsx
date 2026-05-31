import {
  ArrowRight,
  Clock3,
  HeartPulse,
  type LucideIcon,
  RotateCcw,
  ShieldCheck,
  Trophy,
  UsersRound,
} from "lucide-react";
import Link from "next/link";

import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const players = [
  { name: "Nora", commander: "Muldrotha", life: 40, color: "bg-player-a" },
  { name: "Theo", commander: "Alela", life: 38, color: "bg-player-b" },
  { name: "Mara", commander: "Isshin", life: 44, color: "bg-player-c" },
  { name: "Sol", commander: "Etali", life: 31, color: "bg-player-d" },
];

const planningRows = [
  ["RSVPs", "7 yes, 2 maybe", "Deck declarations open"],
  ["Pods", "One locked seat", "Generate after Theo answers"],
  ["Game log", "3 recent games", "Meta freshness: good"],
];

export default function Home() {
  return (
    <AppShell>
      <div className="grid gap-6 xl:grid-cols-[1.35fr_0.85fr]">
        <section className="min-w-0 rounded-panel border border-border bg-surface p-4 shadow-sm sm:p-5">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-2xl font-bold leading-tight sm:text-3xl">
                Life Counter
              </h1>
              <p className="mt-1 text-sm font-medium text-muted">
                Four-player Commander view
              </p>
            </div>
            <div className="flex gap-2">
              <Button asChild variant="primary">
                <Link href="/life">
                  <HeartPulse className="size-4" aria-hidden="true" />
                  Open Counter
                </Link>
              </Button>
              <Button variant="secondary" size="icon" aria-label="Undo">
                <RotateCcw className="size-4" aria-hidden="true" />
              </Button>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            {players.map((player) => (
              <article
                key={player.name}
                className="grid min-h-44 grid-rows-[auto_1fr_auto] rounded-control border border-border bg-background p-4"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="truncate text-lg font-bold">
                      {player.name}
                    </h2>
                    <p className="truncate text-sm font-medium text-muted">
                      {player.commander}
                    </p>
                  </div>
                  <span
                    className={`size-4 rounded-full ${player.color}`}
                    aria-hidden="true"
                  />
                </div>
                <div className="flex items-center justify-center py-3">
                  <span className="tabular-nums text-7xl font-black leading-none">
                    {player.life}
                  </span>
                </div>
                <div className="grid grid-cols-4 gap-2">
                  {["-10", "-5", "+5", "+10"].map((value) => (
                    <button
                      key={value}
                      className="h-11 rounded-control border border-border bg-surface text-sm font-bold hover:bg-surface-strong"
                      type="button"
                    >
                      {value}
                    </button>
                  ))}
                </div>
              </article>
            ))}
          </div>
        </section>

        <aside className="grid gap-6">
          <section className="rounded-panel border border-border bg-surface p-4 shadow-sm sm:p-5">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-bold">Game Night</h2>
                <p className="text-sm font-medium text-muted">
                  Tonight at 7:00 PM
                </p>
              </div>
              <Button size="icon" aria-label="Open Game Night">
                <ArrowRight className="size-4" aria-hidden="true" />
              </Button>
            </div>
            <div className="divide-y divide-border rounded-control border border-border bg-background">
              {planningRows.map(([label, value, note]) => (
                <div
                  className="grid gap-1 p-3 sm:grid-cols-[7rem_1fr]"
                  key={label}
                >
                  <span className="text-xs font-bold uppercase tracking-wide text-muted">
                    {label}
                  </span>
                  <span>
                    <span className="block text-sm font-bold">{value}</span>
                    <span className="block text-sm text-muted">{note}</span>
                  </span>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-panel border border-border bg-surface p-4 shadow-sm sm:p-5">
            <Tabs defaultValue="host">
              <TabsList aria-label="Game night views">
                <TabsTrigger value="host">
                  <ShieldCheck className="mr-2 size-4" aria-hidden="true" />
                  Host
                </TabsTrigger>
                <TabsTrigger value="table">
                  <UsersRound className="mr-2 size-4" aria-hidden="true" />
                  Table
                </TabsTrigger>
              </TabsList>
              <TabsContent value="host">
                <dl className="grid grid-cols-3 gap-3">
                  <Metric icon={UsersRound} label="Players" value="9" />
                  <Metric icon={Clock3} label="Late" value="1" />
                  <Metric icon={Trophy} label="Games" value="3" />
                </dl>
              </TabsContent>
              <TabsContent value="table">
                <div className="rounded-control border border-border bg-background p-3 text-sm font-medium">
                  Pod 1 ready
                </div>
              </TabsContent>
            </Tabs>
          </section>
        </aside>
      </div>
    </AppShell>
  );
}

function Metric({
  icon: Icon,
  label,
  value,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-control border border-border bg-background p-3">
      <Icon className="mb-3 size-4 text-accent" aria-hidden="true" />
      <dt className="text-xs font-bold uppercase tracking-wide text-muted">
        {label}
      </dt>
      <dd className="text-2xl font-black">{value}</dd>
    </div>
  );
}

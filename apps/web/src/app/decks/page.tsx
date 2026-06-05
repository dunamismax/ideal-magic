import {
  LibraryBig,
  LinkIcon,
  Shield,
  type LucideIcon,
  UsersRound,
} from "lucide-react";

import { PageFrame } from "@/components/page-frame";
import { EmptyState } from "@/components/ui/empty-state";
import { createDatabase } from "@/db/client";
import { listDecksForOwner, type ViewerDeck } from "@/db/queries/decks";
import { listPlaygroupsForViewer } from "@/db/queries/playgroups";
import { requireServerSession } from "@/features/auth/server";
import { CreateDeckForm } from "./create-deck-form";

export const dynamic = "force-dynamic";

export default async function DecksPage() {
  const session = await requireServerSession("/decks");
  const db = createDatabase();
  const [decks, playgroups] = await Promise.all([
    listDecksForOwner(db, {
      ownerUserId: session.user.id,
    }),
    listPlaygroupsForViewer(db, {
      viewerUserId: session.user.id,
    }),
  ]);
  const deckFormPlaygroups = playgroups.map((playgroup) => ({
    id: playgroup.id,
    name: playgroup.name,
  }));
  const playgroupDecks = decks.filter(
    (deck) => deck.visibility === "playgroup",
  ).length;
  const publicDecks = decks.filter(
    (deck) => deck.visibility === "public",
  ).length;

  return (
    <PageFrame title="Decks">
      <div className="grid gap-4 xl:grid-cols-[0.8fr_1.2fr]">
        <section className="grid gap-3">
          <CreateDeckForm playgroups={deckFormPlaygroups} />

          <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-1">
            <Panel
              icon={LibraryBig}
              title="Decks"
              value={String(decks.length)}
            />
            <Panel
              icon={UsersRound}
              title="Playgroup"
              value={String(playgroupDecks)}
            />
            <Panel icon={Shield} title="Public" value={String(publicDecks)} />
          </div>
        </section>

        <section className="grid gap-3">
          {decks.length > 0 ? (
            decks.map((deck) => <DeckCard deck={deck} key={deck.id} />)
          ) : (
            <EmptyState icon={LibraryBig} title="No decks created" />
          )}
        </section>
      </div>
    </PageFrame>
  );
}

export function DeckCard({ deck }: { deck: ViewerDeck }) {
  return (
    <article className="rounded-panel border border-border bg-surface p-4 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-base font-bold">{deck.name}</h2>
          <p className="mt-1 text-sm font-semibold text-muted">
            {deck.commanders.join(" / ")}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge value={formatVisibility(deck.visibility)} />
          {deck.playgroup ? <Badge value={deck.playgroup.name} /> : null}
          {deck.colorIdentity ? <Badge value={deck.colorIdentity} /> : null}
        </div>
      </div>

      <div className="mt-4 grid gap-2 text-sm font-semibold text-muted sm:grid-cols-3">
        <Metric label="Bracket" value={deck.bracket ?? "Unset"} />
        <Metric
          label="Power"
          value={deck.powerEstimate ? String(deck.powerEstimate) : "Unset"}
        />
        <Metric label="Archetype" value={deck.archetype || "Unset"} />
      </div>

      {deck.tags.length > 0 ? (
        <div className="mt-4 flex flex-wrap gap-2">
          {deck.tags.map((tag) => (
            <Badge key={tag} value={tag} />
          ))}
        </div>
      ) : null}

      {deck.externalUrl ? (
        <a
          className="mt-4 inline-flex items-center gap-2 text-sm font-bold text-accent underline-offset-4 hover:underline"
          href={deck.externalUrl}
          rel="noreferrer"
          target="_blank"
        >
          <LinkIcon className="size-4" aria-hidden="true" />
          Deck Link
        </a>
      ) : null}
    </article>
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
    <div className="rounded-panel border border-border bg-surface p-4 shadow-sm">
      <Icon className="mb-4 size-5 text-accent" aria-hidden="true" />
      <h2 className="text-xs font-bold uppercase text-muted">{title}</h2>
      <p className="mt-1 text-2xl font-black">{value}</p>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-control bg-background px-3 py-2">
      <span className="block text-xs font-bold uppercase text-muted">
        {label}
      </span>
      <span className="text-base font-black text-foreground">{value}</span>
    </div>
  );
}

function Badge({ value }: { value: string }) {
  return (
    <span className="inline-flex w-fit items-center rounded-control border border-border bg-background px-2 py-1 text-xs font-bold uppercase text-muted">
      {value}
    </span>
  );
}

function formatVisibility(visibility: ViewerDeck["visibility"]) {
  switch (visibility) {
    case "playgroup":
      return "Playgroup";
    case "public":
      return "Public";
    default:
      return "Private";
  }
}

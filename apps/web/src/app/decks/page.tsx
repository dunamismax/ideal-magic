import { PageFrame } from "@/components/page-frame";
import { requireServerSession } from "@/features/auth/server";

export const dynamic = "force-dynamic";

export default async function DecksPage() {
  await requireServerSession("/decks");

  return (
    <PageFrame title="Decks">
      <div className="rounded-control border border-border bg-background p-4 text-sm font-semibold">
        Declared decks
      </div>
    </PageFrame>
  );
}

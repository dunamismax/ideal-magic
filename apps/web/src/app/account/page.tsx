import { PageFrame } from "@/components/page-frame";
import { requireServerSession } from "@/features/auth/server";
import { LogoutButton } from "./logout-button";

export const dynamic = "force-dynamic";

export default async function AccountPage() {
  const session = await requireServerSession("/account");

  return (
    <PageFrame eyebrow="Account" title="Account">
      <section className="grid gap-4 rounded-panel border border-border bg-surface p-4 shadow-sm sm:p-5">
        <div>
          <h2 className="text-xl font-bold">{session.user.name}</h2>
          <p className="text-sm font-semibold text-muted">
            {session.user.email}
          </p>
        </div>
        <div className="rounded-control border border-border bg-background p-3 text-sm font-semibold">
          Session active
        </div>
        <div>
          <LogoutButton />
        </div>
      </section>
    </PageFrame>
  );
}

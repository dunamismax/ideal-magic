import type { ReactNode } from "react";

import { AppShell } from "@/components/app-shell";

export function PageFrame({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <AppShell>
      <section className="rounded-panel border border-border bg-surface p-5 shadow-sm">
        <h1 className="text-2xl font-bold leading-tight sm:text-3xl">
          {title}
        </h1>
        <div className="mt-5">{children}</div>
      </section>
    </AppShell>
  );
}

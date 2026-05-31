import type { ReactNode } from "react";

import { AppShell } from "@/components/app-shell";

export function PageFrame({
  title,
  eyebrow,
  actions,
  children,
}: {
  title: string;
  eyebrow?: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <AppShell>
      <section className="grid gap-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            {eyebrow ? (
              <p className="text-xs font-bold uppercase text-muted">
                {eyebrow}
              </p>
            ) : null}
            <h1 className="text-2xl font-bold leading-tight sm:text-3xl">
              {title}
            </h1>
          </div>
          {actions ? (
            <div className="flex flex-wrap gap-2">{actions}</div>
          ) : null}
        </div>
        {children}
      </section>
    </AppShell>
  );
}

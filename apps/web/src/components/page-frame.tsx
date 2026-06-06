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
      <section className="grid min-w-0 gap-4">
        <div className="flex min-w-0 w-full flex-col gap-3">
          <div className="min-w-0 max-w-full">
            {eyebrow ? (
              <p className="text-xs font-bold uppercase text-muted [overflow-wrap:anywhere]">
                {eyebrow}
              </p>
            ) : null}
            <h1 className="text-2xl font-bold leading-tight [overflow-wrap:anywhere] sm:text-3xl">
              {title}
            </h1>
          </div>
          {actions ? (
            <div className="flex min-w-0 flex-wrap gap-2">{actions}</div>
          ) : null}
        </div>
        {children}
      </section>
    </AppShell>
  );
}

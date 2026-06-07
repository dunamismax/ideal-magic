import type { ReactNode } from "react";

import { AppShell } from "@/components/app-shell";
import { cn } from "@/lib/utils";

export function PageFrame({
  title,
  eyebrow,
  actions,
  children,
  mobileImmersive = false,
}: {
  title: string;
  eyebrow?: string;
  actions?: ReactNode;
  children: ReactNode;
  mobileImmersive?: boolean;
}) {
  return (
    <AppShell mobileImmersive={mobileImmersive}>
      <section
        className={cn(
          "grid min-w-0 gap-4",
          mobileImmersive && "max-md:h-dvh max-md:gap-0 max-md:overflow-hidden",
        )}
      >
        {mobileImmersive ? (
          <div className="sr-only md:hidden">
            {eyebrow ? <p>{eyebrow}</p> : null}
            <h1>{title}</h1>
          </div>
        ) : null}
        <div
          className={cn(
            "flex min-w-0 w-full flex-col gap-3",
            mobileImmersive && "max-md:hidden",
          )}
        >
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

import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "grid min-h-40 place-items-center rounded-control border border-dashed border-border bg-background p-5 text-center",
        className,
      )}
    >
      <div className="grid max-w-sm gap-3 justify-items-center">
        <Icon className="size-6 text-accent" aria-hidden="true" />
        <div>
          <h2 className="text-base font-bold">{title}</h2>
          {description ? (
            <p className="mt-1 text-sm font-medium text-muted">{description}</p>
          ) : null}
        </div>
        {action}
      </div>
    </div>
  );
}

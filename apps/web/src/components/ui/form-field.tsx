import * as LabelPrimitive from "@radix-ui/react-label";
import type { ComponentProps, ReactNode } from "react";

import { cn } from "@/lib/utils";

export function FormField({
  label,
  hint,
  error,
  children,
  className,
}: {
  label: string;
  hint?: string;
  error?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={cn("grid gap-1.5", className)}>
      <span className="text-xs font-bold uppercase text-muted">{label}</span>
      {children}
      {error ? (
        <span className="text-xs font-bold text-danger">{error}</span>
      ) : hint ? (
        <span className="text-xs font-medium text-muted">{hint}</span>
      ) : null}
    </label>
  );
}

export function FieldLabel({
  className,
  ...props
}: ComponentProps<typeof LabelPrimitive.Root>) {
  return (
    <LabelPrimitive.Root
      className={cn("text-xs font-bold uppercase text-muted", className)}
      {...props}
    />
  );
}

export const fieldControlClassName =
  "min-h-10 w-full rounded-control border border-border bg-surface px-3 text-sm font-semibold text-foreground outline-none transition-colors placeholder:text-muted focus-visible:border-focus";

"use client";

import { cn } from "@/lib/utils";

export type SegmentedOption = {
  value: string;
  label: string;
  disabled?: boolean;
};

export function SegmentedControl({
  label,
  options,
  value,
  onValueChange,
  className,
}: {
  label: string;
  options: SegmentedOption[];
  value: string;
  onValueChange: (value: string) => void;
  className?: string;
}) {
  return (
    <div
      aria-label={label}
      className={cn(
        "inline-grid rounded-control border border-border bg-surface p-1",
        className,
      )}
      role="radiogroup"
    >
      {options.map((option) => (
        <button
          aria-checked={option.value === value}
          className={cn(
            "min-h-8 rounded-[0.375rem] px-3 text-sm font-bold text-muted transition-colors",
            option.value === value && "bg-foreground text-background",
          )}
          disabled={option.disabled}
          key={option.value}
          onClick={() => onValueChange(option.value)}
          role="radio"
          type="button"
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

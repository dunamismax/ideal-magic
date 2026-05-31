import type { ComponentProps, ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function IconButton({
  label,
  className,
  children,
  ...props
}: Omit<ComponentProps<typeof Button>, "size" | "children"> & {
  label: string;
  children: ReactNode;
}) {
  return (
    <Button
      aria-label={label}
      className={cn("relative", className)}
      size="icon"
      title={label}
      {...props}
    >
      {children}
    </Button>
  );
}

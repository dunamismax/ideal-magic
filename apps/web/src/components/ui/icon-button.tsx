import { forwardRef, type ComponentProps, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const IconButton = forwardRef<
  HTMLButtonElement,
  Omit<ComponentProps<typeof Button>, "size" | "children"> & {
    label: string;
    children: ReactNode;
  }
>(({ label, className, children, ...props }, ref) => {
  return (
    <Button
      aria-label={label}
      className={cn("relative", className)}
      ref={ref}
      size="icon"
      title={label}
      {...props}
    >
      {children}
    </Button>
  );
});
IconButton.displayName = "IconButton";

"use client";

import * as DropdownMenuPrimitive from "@radix-ui/react-dropdown-menu";
import type { ComponentProps } from "react";

import { cn } from "@/lib/utils";

export const Menu = DropdownMenuPrimitive.Root;
export const MenuTrigger = DropdownMenuPrimitive.Trigger;
export const MenuGroup = DropdownMenuPrimitive.Group;
export const MenuLabel = DropdownMenuPrimitive.Label;
export const MenuSeparator = DropdownMenuPrimitive.Separator;

export function MenuContent({
  className,
  align = "end",
  ...props
}: ComponentProps<typeof DropdownMenuPrimitive.Content>) {
  return (
    <DropdownMenuPrimitive.Portal>
      <DropdownMenuPrimitive.Content
        align={align}
        className={cn(
          "z-50 min-w-52 rounded-control border border-border bg-surface p-1 shadow-lg",
          className,
        )}
        sideOffset={6}
        {...props}
      />
    </DropdownMenuPrimitive.Portal>
  );
}

export function MenuItem({
  className,
  ...props
}: ComponentProps<typeof DropdownMenuPrimitive.Item>) {
  return (
    <DropdownMenuPrimitive.Item
      className={cn(
        "flex min-h-9 cursor-default select-none items-center gap-2 rounded-[0.375rem] px-3 text-sm font-semibold outline-none data-[highlighted]:bg-surface-strong",
        className,
      )}
      {...props}
    />
  );
}

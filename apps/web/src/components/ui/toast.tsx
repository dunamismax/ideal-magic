"use client";

import * as ToastPrimitive from "@radix-ui/react-toast";
import { X } from "lucide-react";
import type { ComponentProps } from "react";

import { IconButton } from "@/components/ui/icon-button";
import { cn } from "@/lib/utils";

export const ToastProvider = ToastPrimitive.Provider;
export const ToastRoot = ToastPrimitive.Root;
export const ToastAction = ToastPrimitive.Action;

export function ToastViewport({
  className,
  ...props
}: ComponentProps<typeof ToastPrimitive.Viewport>) {
  return (
    <ToastPrimitive.Viewport
      className={cn(
        "fixed bottom-4 right-4 z-50 grid w-[min(calc(100vw-2rem),24rem)] gap-2",
        className,
      )}
      {...props}
    />
  );
}

export function ToastTitle({
  className,
  ...props
}: ComponentProps<typeof ToastPrimitive.Title>) {
  return (
    <ToastPrimitive.Title
      className={cn("text-sm font-bold", className)}
      {...props}
    />
  );
}

export function ToastDescription({
  className,
  ...props
}: ComponentProps<typeof ToastPrimitive.Description>) {
  return (
    <ToastPrimitive.Description
      className={cn("text-sm text-muted", className)}
      {...props}
    />
  );
}

export function ToastClose({
  className,
  ...props
}: ComponentProps<typeof ToastPrimitive.Close>) {
  return (
    <ToastPrimitive.Close asChild {...props}>
      <IconButton
        className={cn("absolute right-2 top-2", className)}
        label="Dismiss"
        variant="ghost"
      >
        <X className="size-4" aria-hidden="true" />
      </IconButton>
    </ToastPrimitive.Close>
  );
}

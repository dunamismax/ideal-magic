"use client";

import Link from "next/link";
import { MoreHorizontal } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Menu,
  MenuContent,
  MenuItem,
  MenuLabel,
  MenuSeparator,
  MenuTrigger,
} from "@/components/ui/menu";

export function QuickActionsMenu() {
  return (
    <Menu>
      <MenuTrigger asChild>
        <Button
          aria-label="Open quick actions"
          className="relative"
          size="icon"
          title="Open quick actions"
          variant="secondary"
        >
          <MoreHorizontal className="size-4" aria-hidden="true" />
        </Button>
      </MenuTrigger>
      <MenuContent>
        <MenuLabel className="px-3 py-2 text-xs font-bold uppercase text-muted">
          Quick actions
        </MenuLabel>
        <MenuSeparator className="my-1 h-px bg-border" />
        <MenuItem asChild>
          <Link href="/life">Start local counter</Link>
        </MenuItem>
        <MenuItem asChild>
          <Link href="/game-night">Schedule event</Link>
        </MenuItem>
        <MenuItem asChild>
          <Link href="/decks">Declare deck</Link>
        </MenuItem>
        <MenuItem asChild>
          <Link href="/signup">Create account</Link>
        </MenuItem>
      </MenuContent>
    </Menu>
  );
}

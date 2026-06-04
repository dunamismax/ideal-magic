import Link from "next/link";
import type { ReactNode } from "react";
import {
  CalendarDays,
  Crown,
  History,
  LibraryBig,
  MoreHorizontal,
  Plus,
  UserCircle,
  Swords,
  Users,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { IconButton } from "@/components/ui/icon-button";
import {
  Menu,
  MenuContent,
  MenuItem,
  MenuLabel,
  MenuSeparator,
  MenuTrigger,
} from "@/components/ui/menu";
import { cn } from "@/lib/utils";

const primaryNav = [
  { href: "/life", label: "Life Counter", icon: Swords, prominent: true },
  {
    href: "/game-night",
    label: "Game Night",
    icon: CalendarDays,
    prominent: true,
  },
  { href: "/groups", label: "Groups", icon: Users },
  { href: "/decks", label: "Decks", icon: LibraryBig },
  { href: "/history", label: "History", icon: History },
];

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-dvh bg-background text-foreground">
      <header className="sticky top-0 z-40 border-b border-border bg-surface/95 backdrop-blur">
        <div className="mx-auto grid max-w-screen-2xl gap-3 px-shell py-3 lg:grid-cols-[auto_1fr_auto] lg:items-center">
          <Link className="flex min-w-0 items-center gap-3" href="/">
            <span className="flex size-10 items-center justify-center rounded-control bg-foreground text-background">
              <Crown className="size-5" aria-hidden="true" />
            </span>
            <span className="min-w-0">
              <span className="block truncate text-base font-bold leading-5">
                Pod Tracker
              </span>
              <span className="block truncate text-xs font-medium text-muted">
                Commander night command center
              </span>
            </span>
          </Link>
          <nav
            aria-label="Primary"
            className="grid grid-flow-col auto-cols-max gap-2 overflow-x-auto pb-1 lg:justify-center lg:pb-0"
          >
            {primaryNav.map((item) => {
              const Icon = item.icon;

              return (
                <Button
                  key={item.href}
                  asChild
                  variant={item.prominent ? "primary" : "secondary"}
                  className={cn("min-w-fit", item.prominent && "shadow-sm")}
                >
                  <Link href={item.href}>
                    <Icon className="size-4" aria-hidden="true" />
                    {item.label}
                  </Link>
                </Button>
              );
            })}
          </nav>
          <div className="hidden items-center gap-2 lg:flex lg:justify-end">
            <Button asChild variant="secondary">
              <Link href="/login">
                <UserCircle className="size-4" aria-hidden="true" />
                Account
              </Link>
            </Button>
            <Button asChild variant="secondary">
              <Link href="/game-night">
                <Plus className="size-4" aria-hidden="true" />
                New Event
              </Link>
            </Button>
            <Menu>
              <MenuTrigger asChild>
                <IconButton label="Open quick actions" variant="secondary">
                  <MoreHorizontal className="size-4" aria-hidden="true" />
                </IconButton>
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
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-screen-2xl px-shell py-4 sm:py-5 lg:py-6">
        {children}
      </main>
    </div>
  );
}

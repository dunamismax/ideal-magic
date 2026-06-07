import Link from "next/link";
import type { ReactNode } from "react";
import {
  CalendarDays,
  Crown,
  History,
  LibraryBig,
  Plus,
  UserCircle,
  Swords,
  Users,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { QuickActionsMenu } from "@/components/quick-actions-menu";
import { ThemeToggle } from "@/components/theme-toggle";
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
        <div className="mx-auto grid min-w-0 max-w-screen-2xl grid-cols-[minmax(0,1fr)_auto] gap-3 px-shell py-3 lg:grid-cols-[auto_minmax(0,1fr)_auto] lg:items-center">
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
            className="col-span-2 grid min-w-0 grid-flow-col auto-cols-max gap-2 overflow-x-auto pb-1 lg:col-span-1 lg:justify-center lg:pb-0"
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
          <div className="flex items-center justify-end gap-2">
            <ThemeToggle />
            <div className="hidden items-center gap-2 lg:flex">
              <Button asChild variant="secondary">
                <Link href="/account">
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
              <QuickActionsMenu />
            </div>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-screen-2xl px-shell py-4 sm:py-5 lg:py-6">
        {children}
      </main>
    </div>
  );
}

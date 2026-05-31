import Link from "next/link";
import type { ReactNode } from "react";
import {
  CalendarDays,
  Crown,
  History,
  LibraryBig,
  Swords,
  Users,
} from "lucide-react";

import { Button } from "@/components/ui/button";
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
      <header className="border-b border-border bg-surface">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-shell py-4 lg:flex-row lg:items-center lg:justify-between">
          <Link className="flex items-center gap-3" href="/">
            <span className="flex size-10 items-center justify-center rounded-control bg-foreground text-background">
              <Crown className="size-5" aria-hidden="true" />
            </span>
            <span>
              <span className="block text-base font-bold leading-5">
                Pod Tracker
              </span>
              <span className="block text-xs font-medium text-muted">
                Commander night command center
              </span>
            </span>
          </Link>
          <nav aria-label="Primary" className="flex gap-2 overflow-x-auto">
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
        </div>
      </header>
      <main className="mx-auto w-full max-w-7xl px-shell py-6 lg:py-8">
        {children}
      </main>
    </div>
  );
}

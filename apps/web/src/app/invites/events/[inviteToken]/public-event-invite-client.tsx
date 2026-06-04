"use client";

import { CircleAlert, LoaderCircle } from "lucide-react";
import { useEffect, useState } from "react";

import { EmptyState } from "@/components/ui/empty-state";
import type { PublicEventInviteView } from "@/features/events/public-event";
import { PublicEventInvite } from "./public-event-invite";

type PublicEventInviteResponse = {
  event: PublicEventInviteView;
};

export function PublicEventInviteClient({
  inviteToken,
}: {
  inviteToken: string;
}) {
  const [event, setEvent] = useState<PublicEventInviteView | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "missing">(
    "loading",
  );

  useEffect(() => {
    let active = true;

    async function loadEvent() {
      setStatus("loading");

      try {
        const response = await fetch(
          `/api/public-events/${encodeURIComponent(inviteToken)}`,
          {
            headers: {
              accept: "application/json",
            },
          },
        );

        if (!response.ok) {
          throw new Error("Invite not available");
        }

        const payload = (await response.json()) as PublicEventInviteResponse;

        if (active) {
          setEvent(payload.event);
          setStatus("ready");
        }
      } catch {
        if (active) {
          setEvent(null);
          setStatus("missing");
        }
      }
    }

    void loadEvent();

    return () => {
      active = false;
    };
  }, [inviteToken]);

  if (status === "loading") {
    return (
      <div className="rounded-panel border border-border bg-surface p-4 shadow-sm">
        <div className="flex items-center gap-3 text-sm font-bold text-muted">
          <LoaderCircle className="size-5 animate-spin" aria-hidden="true" />
          Loading invite
        </div>
      </div>
    );
  }

  if (!event) {
    return (
      <EmptyState
        icon={CircleAlert}
        title="Event invite unavailable"
        description="The invite may be expired, mistyped, or not public-safe."
      />
    );
  }

  return <PublicEventInvite event={event} />;
}

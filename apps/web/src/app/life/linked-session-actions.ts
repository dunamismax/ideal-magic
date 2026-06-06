"use server";

import { createDatabase } from "@/db/client";
import {
  LinkedLifeCounterAuthorizationError,
  LinkedLifeCounterValidationError,
  persistLinkedLifeCounterSession,
  type LinkedLifeCounterKind,
} from "@/db/queries/life-counter";
import { requireServerSession } from "@/features/auth/server";
import type { LifeCounterSession } from "@/features/life/session";
import { assertSameOriginServerAction } from "@/features/security/csrf";
import { rateLimitPolicies } from "@/features/security/rate-limit";
import { trackAnalyticsEvent } from "@/lib/analytics";
import { logServerError } from "@/lib/logger";

export type SyncLinkedLifeCounterSessionInput = {
  kind: LinkedLifeCounterKind;
  eventId: string;
  podId?: string | null;
  localSessionKey: string;
  expectedServerActionSequence: number | null;
  expectedServerUpdatedAt: string | null;
  session: LifeCounterSession;
};

export type SyncLinkedLifeCounterSessionResult =
  | {
      ok: true;
      serverActionSequence: number;
      serverUpdatedAt: string;
    }
  | {
      ok: false;
      reason: "conflict" | "unauthorized" | "invalid" | "error";
      message: string;
      serverActionSequence: number | null;
      serverUpdatedAt: string | null;
    };

export async function syncLinkedLifeCounterSessionAction(
  input: SyncLinkedLifeCounterSessionInput,
): Promise<SyncLinkedLifeCounterSessionResult> {
  await assertSameOriginServerAction({
    rateLimit: rateLimitPolicies.write,
    scope: ["life", input.kind, "sync-snapshot"],
  });

  const session = await requireServerSession(getLinkedLifeCounterPath(input));

  try {
    const result = await persistLinkedLifeCounterSession(createDatabase(), {
      viewerUserId: session.user.id,
      ...input,
    });

    if (!result.ok) {
      return {
        ok: false,
        reason: "conflict",
        message:
          "Server snapshot changed after this table loaded. Reload before syncing.",
        serverActionSequence: result.serverActionSequence,
        serverUpdatedAt: result.serverUpdatedAt,
      };
    }

    void trackAnalyticsEvent("linked_life_counter_synced");

    return result;
  } catch (error) {
    if (error instanceof LinkedLifeCounterAuthorizationError) {
      return {
        ok: false,
        reason: "unauthorized",
        message: "You cannot sync this linked table.",
        serverActionSequence: null,
        serverUpdatedAt: null,
      };
    }

    if (error instanceof LinkedLifeCounterValidationError) {
      return {
        ok: false,
        reason: "invalid",
        message: "This linked table cannot be synced.",
        serverActionSequence: null,
        serverUpdatedAt: null,
      };
    }

    logServerError("linked_life_counter_sync_failed", error, {
      component: "life",
    });

    return {
      ok: false,
      reason: "error",
      message: "Linked table could not be synced.",
      serverActionSequence: null,
      serverUpdatedAt: null,
    };
  }
}

function getLinkedLifeCounterPath(input: SyncLinkedLifeCounterSessionInput) {
  if (input.kind === "pod" && input.podId) {
    return `/events/${input.eventId}/pods/${input.podId}/life`;
  }

  return `/events/${input.eventId}/life`;
}

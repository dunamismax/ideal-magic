import type { AppDatabase } from "./client";
import { auditEvents } from "./schema";

type AuditDatabase = Pick<AppDatabase, "insert">;

export type AuditEventAction =
  | "playgroup.invite.created"
  | "playgroup.invite.revoked"
  | "playgroup.updated"
  | "playgroup.archived"
  | "playgroup.member.role_changed"
  | "playgroup.member.removed"
  | "event.visibility.changed"
  | "event.location.changed"
  | "game.result.corrected"
  | "auth.signup"
  | "auth.login"
  | "auth.logout"
  | "auth.password_reset_requested"
  | "auth.password_reset_completed"
  | "auth.email_verification_requested"
  | "auth.email_verified"
  | "auth.email_change_requested";

type AuditMetadataValue = string | number | boolean | null;
export type AuditMetadata = Record<string, AuditMetadataValue>;

export async function recordAuditEvent(
  db: AuditDatabase,
  input: {
    action: AuditEventAction;
    actorUserId?: string | null;
    playgroupId?: string | null;
    eventId?: string | null;
    targetType: string;
    targetId?: string | null;
    metadata?: Record<string, unknown>;
  },
) {
  const [event] = await db
    .insert(auditEvents)
    .values({
      action: input.action,
      actorUserId: input.actorUserId ?? null,
      playgroupId: input.playgroupId ?? null,
      eventId: input.eventId ?? null,
      targetType: input.targetType,
      targetId: input.targetId ?? null,
      metadata: toSafeAuditMetadata(input.metadata ?? {}),
    })
    .returning({
      id: auditEvents.id,
    });

  if (!event) {
    throw new Error("Expected audit event insert to return a row.");
  }

  return event;
}

export function toSafeAuditMetadata(
  metadata: Record<string, unknown>,
): AuditMetadata {
  const safeMetadata: AuditMetadata = {};

  for (const [key, value] of Object.entries(metadata)) {
    if (!isSafeAuditMetadataKey(key) || hasSensitiveKeyFragment(key)) {
      continue;
    }

    const safeValue = toSafeAuditMetadataValue(value);

    if (safeValue !== undefined) {
      safeMetadata[key] = safeValue;
    }
  }

  return safeMetadata;
}

function isSafeAuditMetadataKey(key: string) {
  return /^[a-z][a-zA-Z0-9_]{0,63}$/.test(key);
}

function hasSensitiveKeyFragment(key: string) {
  return [
    "address",
    "email",
    "guest",
    "note",
    "password",
    "payload",
    "phone",
    "raw",
    "secret",
    "token",
  ].some((fragment) => key.toLowerCase().includes(fragment));
}

function toSafeAuditMetadataValue(
  value: unknown,
): AuditMetadataValue | undefined {
  if (value === null) {
    return null;
  }

  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "number") {
    return Number.isFinite(value) ? value : undefined;
  }

  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();

  if (
    trimmed.length === 0 ||
    trimmed.length > 128 ||
    looksLikeEmail(trimmed) ||
    (!looksLikeUuid(trimmed) && looksLikeSecret(trimmed))
  ) {
    return undefined;
  }

  return trimmed;
}

function looksLikeEmail(value: string) {
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value);
}

function looksLikeUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}

function looksLikeSecret(value: string) {
  return /^[A-Za-z0-9_-]{32,}$/.test(value);
}

import { createHash, randomBytes } from "node:crypto";

export function generateInviteToken() {
  return randomBytes(32).toString("base64url");
}

export function normalizeInviteToken(token: string) {
  const normalized = token.trim();

  return normalized.length > 0 ? normalized : null;
}

export function hashInviteToken(token: string) {
  const normalized = normalizeInviteToken(token);

  if (!normalized) {
    throw new Error("Invite token must not be blank");
  }

  return createHash("sha256").update(normalized, "utf8").digest("hex");
}

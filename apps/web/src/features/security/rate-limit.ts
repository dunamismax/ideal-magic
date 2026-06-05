import { createHash } from "node:crypto";

import { createClient, type RedisClientType } from "redis";

type HeaderSource = Pick<Headers, "get">;

export type RateLimitPolicy = {
  name: string;
  max: number;
  windowSeconds: number;
};

type RateLimitHit = {
  count: number;
  ttlSeconds: number;
};

export type RateLimitStore = {
  hit(key: string, windowSeconds: number): Promise<RateLimitHit>;
};

export const rateLimitPolicies = {
  auth: {
    name: "auth",
    max: 12,
    windowSeconds: 60,
  },
  invite: {
    name: "invite",
    max: 10,
    windowSeconds: 60,
  },
  publicGuestRsvp: {
    name: "public-guest-rsvp",
    max: 8,
    windowSeconds: 60,
  },
  write: {
    name: "app-write",
    max: 60,
    windowSeconds: 60,
  },
} satisfies Record<string, RateLimitPolicy>;

export class RateLimitError extends Error {
  constructor(
    readonly retryAfterSeconds: number,
    readonly limit: number,
  ) {
    super("Too many requests");
    this.name = "RateLimitError";
  }
}

export class RateLimitUnavailableError extends Error {
  constructor() {
    super("Rate limiting is unavailable");
    this.name = "RateLimitUnavailableError";
  }
}

let rateLimitStoreOverride: RateLimitStore | null = null;
let valkeyStore: RateLimitStore | null = null;
const memoryStore = createMemoryRateLimitStore();

export async function enforceRateLimitForRequest(
  request: Request,
  policy: RateLimitPolicy,
  scopeParts: string[] = [],
) {
  await enforceRateLimitForHeaders(request.headers, policy, scopeParts);
}

export async function enforceRateLimitForHeaders(
  requestHeaders: HeaderSource,
  policy: RateLimitPolicy,
  scopeParts: string[] = [],
) {
  const key = createRateLimitKey(policy.name, [
    getClientIpIdentity(requestHeaders),
    ...scopeParts,
  ]);
  let hit: RateLimitHit;

  try {
    hit = await getRateLimitStore().hit(key, policy.windowSeconds);
  } catch (error) {
    if (error instanceof RateLimitUnavailableError) {
      throw error;
    }

    throw new RateLimitUnavailableError();
  }

  if (hit.count > policy.max) {
    throw new RateLimitError(
      Math.max(1, hit.ttlSeconds || policy.windowSeconds),
      policy.max,
    );
  }
}

export function rateLimitResponse(
  error: unknown,
  message = "Too many requests. Try again later.",
) {
  if (error instanceof RateLimitError) {
    return Response.json(
      { error: message },
      {
        status: 429,
        headers: {
          "retry-after": String(error.retryAfterSeconds),
        },
      },
    );
  }

  if (error instanceof RateLimitUnavailableError) {
    return Response.json(
      { error: "Request protection is temporarily unavailable." },
      { status: 503 },
    );
  }

  throw error;
}

export function setRateLimitStoreForTests(store: RateLimitStore | null) {
  rateLimitStoreOverride = store;
}

export function resetMemoryRateLimitStoreForTests() {
  memoryStore.clear();
}

function getRateLimitStore() {
  if (rateLimitStoreOverride) {
    return rateLimitStoreOverride;
  }

  const valkeyUrl = process.env.VALKEY_URL ?? process.env.REDIS_URL;

  if (valkeyUrl) {
    valkeyStore ??= createValkeyRateLimitStore(valkeyUrl);
    return valkeyStore;
  }

  if (process.env.NODE_ENV === "production") {
    throw new RateLimitUnavailableError();
  }

  return memoryStore;
}

function createValkeyRateLimitStore(url: string): RateLimitStore {
  const client = createClient({ url });
  let connectionPromise: Promise<RedisClientType> | null = null;

  client.on("error", () => {
    if (process.env.NODE_ENV !== "test") {
      console.error("Valkey rate limit client error");
    }
  });

  async function getClient() {
    connectionPromise ??= client.connect().then(
      () => client,
      (error: unknown) => {
        connectionPromise = null;
        throw error;
      },
    );
    return connectionPromise;
  }

  return {
    async hit(key, windowSeconds) {
      const connectedClient = await getClient();
      const result = await connectedClient.eval(rateLimitLuaScript, {
        keys: [key],
        arguments: [String(windowSeconds)],
      });

      return parseValkeyRateLimitHit(result, windowSeconds);
    },
  };
}

function createMemoryRateLimitStore(): RateLimitStore & { clear(): void } {
  const hits = new Map<string, { count: number; resetAt: number }>();

  return {
    async hit(key, windowSeconds) {
      const now = Date.now();
      const current = hits.get(key);

      if (!current || current.resetAt <= now) {
        const resetAt = now + windowSeconds * 1000;
        hits.set(key, { count: 1, resetAt });
        return { count: 1, ttlSeconds: windowSeconds };
      }

      current.count += 1;
      return {
        count: current.count,
        ttlSeconds: Math.max(1, Math.ceil((current.resetAt - now) / 1000)),
      };
    },
    clear() {
      hits.clear();
    },
  };
}

function parseValkeyRateLimitHit(
  result: unknown,
  fallbackTtlSeconds: number,
): RateLimitHit {
  if (!Array.isArray(result) || result.length < 2) {
    throw new RateLimitUnavailableError();
  }

  const [count, ttlSeconds] = result.map(Number);

  if (!Number.isFinite(count)) {
    throw new RateLimitUnavailableError();
  }

  return {
    count,
    ttlSeconds: Number.isFinite(ttlSeconds)
      ? Math.max(1, ttlSeconds)
      : fallbackTtlSeconds,
  };
}

function createRateLimitKey(policyName: string, identityParts: string[]) {
  const digest = createHash("sha256")
    .update([policyName, ...identityParts].join("\0"))
    .digest("hex");

  return `pod-tracker:rate-limit:${policyName}:${digest}`;
}

function getClientIpIdentity(requestHeaders: HeaderSource) {
  const clientIp =
    requestHeaders.get("cf-connecting-ip") ??
    firstForwardedForIp(requestHeaders.get("x-forwarded-for")) ??
    requestHeaders.get("x-real-ip") ??
    "unknown";

  return `ip:${clientIp}`;
}

function firstForwardedForIp(value: string | null) {
  return value
    ?.split(",")
    .map((part) => part.trim())
    .find(Boolean);
}

const rateLimitLuaScript = `
local count = redis.call("INCR", KEYS[1])
if count == 1 then
  redis.call("EXPIRE", KEYS[1], ARGV[1])
end
local ttl = redis.call("TTL", KEYS[1])
return { count, ttl }
`;

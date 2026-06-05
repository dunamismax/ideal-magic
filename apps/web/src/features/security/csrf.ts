import { headers } from "next/headers";

import { isTrustedHeadersOrigin } from "@/features/security/origin";
import {
  enforceRateLimitForHeaders,
  type RateLimitPolicy,
} from "@/features/security/rate-limit";

export class CsrfError extends Error {
  constructor() {
    super("Request origin is not allowed");
    this.name = "CsrfError";
  }
}

type ServerActionSecurityOptions = {
  rateLimit?: RateLimitPolicy;
  scope?: string[];
};

export async function assertSameOriginServerAction(
  options: ServerActionSecurityOptions = {},
) {
  const requestHeaders = await headers();

  if (!isTrustedHeadersOrigin(requestHeaders)) {
    throw new CsrfError();
  }

  if (options.rateLimit) {
    await enforceRateLimitForHeaders(
      requestHeaders,
      options.rateLimit,
      options.scope,
    );
  }
}

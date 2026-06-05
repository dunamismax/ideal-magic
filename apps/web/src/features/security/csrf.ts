import { headers } from "next/headers";

import { isTrustedHeadersOrigin } from "@/features/security/origin";

export class CsrfError extends Error {
  constructor() {
    super("Request origin is not allowed");
    this.name = "CsrfError";
  }
}

export async function assertSameOriginServerAction() {
  if (!isTrustedHeadersOrigin(await headers())) {
    throw new CsrfError();
  }
}

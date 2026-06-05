const localDevelopmentBaseUrl = "http://localhost:3000";

type AppBaseUrlOptions = {
  requireConfiguredProductionUrl?: boolean;
};

export function getAppBaseUrl({
  requireConfiguredProductionUrl = true,
}: AppBaseUrlOptions = {}) {
  const configuredBaseUrl =
    process.env.BETTER_AUTH_URL ?? process.env.NEXT_PUBLIC_APP_URL;

  if (!configuredBaseUrl) {
    if (
      process.env.NODE_ENV === "production" &&
      requireConfiguredProductionUrl
    ) {
      throw new Error(
        "BETTER_AUTH_URL or NEXT_PUBLIC_APP_URL is required in production",
      );
    }

    return localDevelopmentBaseUrl;
  }

  const origin = normalizeHttpOrigin(configuredBaseUrl);

  if (!origin) {
    throw new Error("Configured app URL must be a valid HTTP(S) origin");
  }

  if (process.env.NODE_ENV === "production" && !origin.startsWith("https://")) {
    throw new Error("Configured app URL must use HTTPS in production");
  }

  return origin;
}

export function getTrustedOrigins(baseUrl = getAppBaseUrl()) {
  const normalizedBaseUrl = normalizeHttpOrigin(baseUrl);

  if (!normalizedBaseUrl) {
    throw new Error("Trusted origin base URL must be a valid HTTP(S) origin");
  }

  return unique(
    [
      normalizedBaseUrl,
      ...parseOriginList(process.env.POD_TRACKER_TRUSTED_ORIGINS),
    ].filter((origin): origin is string => Boolean(origin)),
  );
}

export function getServerActionAllowedOrigins() {
  return getTrustedOrigins(
    getAppBaseUrl({ requireConfiguredProductionUrl: false }),
  ).map((origin) => new URL(origin).host);
}

export function isTrustedRequestOrigin(
  request: Request,
  trustedOrigins = getTrustedOrigins(),
) {
  const originHeader = request.headers.get("origin");
  const refererHeader = request.headers.get("referer");
  const requestOrigin =
    normalizeHttpOrigin(originHeader) ?? normalizeHttpOrigin(refererHeader);

  if (!requestOrigin) {
    return process.env.NODE_ENV !== "production";
  }

  return trustedOrigins.includes(requestOrigin);
}

export function parseOriginList(value: string | undefined) {
  if (!value) {
    return [];
  }

  return unique(
    value
      .split(",")
      .map((origin) => normalizeHttpOrigin(origin))
      .filter((origin): origin is string => Boolean(origin)),
  );
}

function normalizeHttpOrigin(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  try {
    const url = new URL(value.trim());

    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return null;
    }

    return url.origin;
  } catch {
    return null;
  }
}

function unique(values: string[]) {
  return Array.from(new Set(values));
}

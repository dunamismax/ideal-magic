import { randomUUID } from "node:crypto";

type ErrorReportingEnv = Partial<NodeJS.ProcessEnv>;

type ErrorReportInput = {
  event: string;
  errorName: string;
  component?: string;
};

type ErrorReportingConfig = {
  dsn: string;
  endpoint: string;
  publicKey: string;
  environment: string;
  release?: string;
};

type SendErrorReportResult = "disabled" | "sent" | "failed";

const sentryVersion = "7";

export async function captureServerErrorReport(
  input: ErrorReportInput,
  env: ErrorReportingEnv = process.env,
  send: typeof fetch = fetch,
): Promise<SendErrorReportResult> {
  const config = readErrorReportingConfig(env);

  if (!config) {
    return "disabled";
  }

  const eventId = randomUUID().replaceAll("-", "");
  const timestamp = new Date().toISOString();
  const payload = {
    event_id: eventId,
    timestamp,
    platform: "javascript",
    logger: "pod-tracker-web",
    level: "error",
    environment: config.environment,
    ...(config.release ? { release: config.release } : {}),
    transaction: input.event,
    tags: {
      ...(input.component ? { component: input.component } : {}),
    },
    exception: {
      values: [
        {
          type: input.errorName,
          value: input.errorName,
        },
      ],
    },
  };
  const envelope = [
    JSON.stringify({
      event_id: eventId,
      sent_at: timestamp,
      dsn: config.dsn,
    }),
    JSON.stringify({ type: "event" }),
    JSON.stringify(payload),
  ].join("\n");

  try {
    const response = await send(config.endpoint, {
      method: "POST",
      headers: {
        "content-type": "application/x-sentry-envelope",
        "x-sentry-auth": [
          `Sentry sentry_version=${sentryVersion}`,
          `sentry_key=${config.publicKey}`,
          "sentry_client=pod-tracker-web/0.1.0",
        ].join(", "),
      },
      body: envelope,
    });

    return response.ok ? "sent" : "failed";
  } catch {
    return "failed";
  }
}

export function readErrorReportingConfigForTests(env: ErrorReportingEnv) {
  return readErrorReportingConfig(env);
}

function readErrorReportingConfig(
  env: ErrorReportingEnv,
): ErrorReportingConfig | null {
  const dsn = env.POD_TRACKER_ERROR_REPORTING_DSN?.trim();

  if (!dsn) {
    return null;
  }

  const parsed = parseSentryCompatibleDsn(dsn);

  if (!parsed) {
    throw new Error("POD_TRACKER_ERROR_REPORTING_DSN must be a valid DSN URL");
  }

  return {
    dsn,
    endpoint: parsed.endpoint,
    publicKey: parsed.publicKey,
    environment:
      env.POD_TRACKER_ERROR_REPORTING_ENVIRONMENT?.trim() ||
      env.NODE_ENV ||
      "development",
    release: env.POD_TRACKER_RELEASE?.trim() || undefined,
  };
}

function parseSentryCompatibleDsn(dsn: string) {
  let parsed: URL;

  try {
    parsed = new URL(dsn);
  } catch {
    return null;
  }

  const publicKey = parsed.username;
  const pathParts = parsed.pathname.split("/").filter(Boolean);
  const projectId = pathParts.at(-1);

  if (!publicKey || !projectId || !["http:", "https:"].includes(parsed.protocol)) {
    return null;
  }

  const basePath = pathParts.slice(0, -1).join("/");
  const baseUrl = `${parsed.origin}${basePath ? `/${basePath}` : ""}`;

  return {
    publicKey,
    endpoint: `${baseUrl}/api/${projectId}/envelope/`,
  };
}

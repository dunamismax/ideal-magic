import { captureServerErrorReport } from "./error-reporting";

type LogLevel = "info" | "warn" | "error";

type SafeLogFields = Record<
  string,
  string | number | boolean | null | undefined
>;

const serviceName = "pod-tracker-web";
const safeEventNamePattern = /^[a-z][a-z0-9._-]{1,95}$/;
const sensitiveFieldNamePattern =
  /(address|auth|cookie|config|dsn|email|guest|hash|host|invite|ip|location|note|password|payload|phone|secret|session|token|user.?agent)/i;
const sensitiveStringPattern =
  /(@|bearer\s+|postgres(?:ql)?:\/\/|redis:\/\/|https?:\/\/|token|secret|password)/i;

export function logInfo(event: string, fields?: SafeLogFields) {
  writeLog("info", event, fields);
}

export function logWarning(event: string, fields?: SafeLogFields) {
  writeLog("warn", event, fields);
}

export function logServerError(
  event: string,
  error?: unknown,
  fields?: SafeLogFields,
) {
  writeLog("error", event, fields, error);
}

export function buildLogEntryForTests(
  level: LogLevel,
  event: string,
  fields?: SafeLogFields,
  error?: unknown,
) {
  return buildLogEntry(level, event, fields, error);
}

function writeLog(
  level: LogLevel,
  event: string,
  fields?: SafeLogFields,
  error?: unknown,
) {
  const entry = buildLogEntry(level, event, fields, error);
  const serialized = JSON.stringify(entry);

  if (level === "error") {
    console.error(serialized);
    const component = fields?.component;

    void captureServerErrorReport({
      event: entry.event,
      errorName: entry.error?.name ?? "Error",
      component: typeof component === "string" ? component : undefined,
    }).catch(() => {});
    return;
  }

  if (level === "warn") {
    console.warn(serialized);
    return;
  }

  console.log(serialized);
}

function buildLogEntry(
  level: LogLevel,
  event: string,
  fields?: SafeLogFields,
  error?: unknown,
) {
  return {
    timestamp: new Date().toISOString(),
    level,
    service: serviceName,
    event: normalizeEventName(event),
    ...sanitizeFields(fields),
    ...(error === undefined ? {} : { error: serializeError(error) }),
  };
}

function normalizeEventName(event: string) {
  const normalized = event.trim().toLowerCase().replaceAll(/\s+/g, "_");

  if (!safeEventNamePattern.test(normalized)) {
    return "application_event";
  }

  return normalized;
}

function sanitizeFields(fields: SafeLogFields | undefined) {
  const sanitized: SafeLogFields = {};

  for (const [key, value] of Object.entries(fields ?? {})) {
    if (value === undefined || sensitiveFieldNamePattern.test(key)) {
      continue;
    }

    if (typeof value === "string" && sensitiveStringPattern.test(value)) {
      sanitized[key] = "[redacted]";
      continue;
    }

    sanitized[key] = value;
  }

  return sanitized;
}

function serializeError(error: unknown) {
  if (error instanceof Error) {
    return {
      name: error.name || "Error",
    };
  }

  return {
    name: "NonErrorThrown",
  };
}

type AnalyticsEnv = Partial<NodeJS.ProcessEnv>;

type TrackAnalyticsResult = "disabled" | "sent" | "failed";

const analyticsEventNamePattern = /^[a-z][a-z0-9._-]{1,95}$/;

export async function trackAnalyticsEvent(
  event: string,
  env: AnalyticsEnv = process.env,
  send: typeof fetch = fetch,
): Promise<TrackAnalyticsResult> {
  const config = readAnalyticsConfig(env);

  if (!config) {
    return "disabled";
  }

  const name = normalizeAnalyticsEvent(event);

  if (!name) {
    return "failed";
  }

  try {
    const response = await send(config.endpoint, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "user-agent": "PodTracker/0.1",
      },
      body: JSON.stringify({
        type: "event",
        payload: {
          hostname: config.hostname,
          url: "/",
          website: config.websiteId,
          name,
        },
      }),
    });

    return response.ok ? "sent" : "failed";
  } catch {
    return "failed";
  }
}

export function readAnalyticsConfigForTests(env: AnalyticsEnv) {
  return readAnalyticsConfig(env);
}

function readAnalyticsConfig(env: AnalyticsEnv) {
  const endpoint = env.POD_TRACKER_UMAMI_API_URL?.trim();
  const websiteId = env.POD_TRACKER_UMAMI_WEBSITE_ID?.trim();

  if (!endpoint || !websiteId) {
    return null;
  }

  return {
    endpoint,
    websiteId,
    hostname: env.POD_TRACKER_UMAMI_HOSTNAME?.trim() || "pod-tracker",
  };
}

function normalizeAnalyticsEvent(event: string) {
  const normalized = event.trim().toLowerCase().replaceAll(/\s+/g, "_");

  if (!analyticsEventNamePattern.test(normalized)) {
    return null;
  }

  return normalized;
}

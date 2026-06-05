import { eq } from "drizzle-orm";
import { afterEach, describe, expect, test, vi } from "vitest";

import { accounts, users } from "@/db/schema";
import { createMigratedPgliteDatabase } from "@/test/migrated-pglite";
import { createPodTrackerAuth } from "./server";

describe("Better Auth integration", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  test("signs up, reads a cookie session, logs out, and logs back in", async () => {
    const { db } = await createMigratedPgliteDatabase();
    const auth = createPodTrackerAuth(db, {
      baseURL: "http://127.0.0.1:3100",
      secret: "pod-tracker-integration-test-secret",
    });
    const email = "riley@example.test";
    const password = "correct-horse-battery";

    const signupResponse = await auth.handler(
      authRequest("/api/auth/sign-up/email", {
        email,
        password,
        name: "Riley Chen",
      }),
    );
    const signupCookie = getCookieHeader(signupResponse);

    expect(signupResponse.status).toBe(200);
    expect(signupCookie).toContain("pod-tracker.session_token=");

    const signupSession = await auth.api.getSession({
      headers: new Headers({ cookie: signupCookie }),
    });

    expect(signupSession?.user).toMatchObject({
      email,
      name: "Riley Chen",
    });

    const [userRow] = await db
      .select({
        id: users.id,
        email: users.email,
        emailVerified: users.emailVerified,
      })
      .from(users)
      .where(eq(users.email, email));

    expect(userRow).toBeDefined();
    if (!userRow) {
      throw new Error("Expected signup to create a user row.");
    }

    const [accountRow] = await db
      .select({
        userId: accounts.userId,
        providerId: accounts.providerId,
        password: accounts.password,
      })
      .from(accounts)
      .where(eq(accounts.userId, userRow.id));

    expect(userRow).toMatchObject({
      email,
      emailVerified: false,
    });
    expect(accountRow).toMatchObject({
      userId: userRow.id,
      providerId: "credential",
    });
    expect(accountRow.password).toBeTruthy();
    expect(accountRow.password).not.toContain(password);

    const signoutResponse = await auth.handler(
      authRequest("/api/auth/sign-out", undefined, signupCookie),
    );
    const signedOutCookie = getCookieHeader(signoutResponse);

    expect(signoutResponse.status).toBe(200);
    expect(
      await auth.api.getSession({
        headers: new Headers({ cookie: signedOutCookie }),
      }),
    ).toBeNull();

    const loginResponse = await auth.handler(
      authRequest("/api/auth/sign-in/email", {
        email,
        password,
      }),
    );
    const loginCookie = getCookieHeader(loginResponse);
    const loginSession = await auth.api.getSession({
      headers: new Headers({ cookie: loginCookie }),
    });

    expect(loginResponse.status).toBe(200);
    expect(loginSession?.user.email).toBe(email);
  });

  test("sets hardened production session cookie attributes", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const { db } = await createMigratedPgliteDatabase();
    const auth = createPodTrackerAuth(db, {
      baseURL: "https://pod-tracker.example.test",
      secret: "pod-tracker-production-cookie-test-secret",
    });

    const signupResponse = await auth.handler(
      authRequest(
        "/api/auth/sign-up/email",
        {
          email: "cookie-check@example.test",
          password: "correct-horse-battery",
          name: "Cookie Check",
        },
        undefined,
        "https://pod-tracker.example.test",
      ),
    );
    const sessionCookie = getSetCookies(signupResponse).find((cookie) =>
      cookie.startsWith("pod-tracker.session_token="),
    );

    expect(signupResponse.status).toBe(200);
    expect(sessionCookie).toBeDefined();
    expect(sessionCookie).toContain("HttpOnly");
    expect(sessionCookie).toContain("SameSite=Lax");
    expect(sessionCookie).toContain("Secure");
  });
});

function authRequest(
  path: string,
  body?: Record<string, string>,
  cookie?: string,
  baseURL = "http://127.0.0.1:3100",
) {
  return new Request(`${baseURL}${path}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      origin: baseURL,
      ...(cookie ? { cookie } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
}

function getCookieHeader(response: Response) {
  return getSetCookies(response)
    .filter(Boolean)
    .map((cookie) => cookie.split(";")[0])
    .join("; ");
}

function getSetCookies(response: Response) {
  const headers = response.headers as Headers & {
    getSetCookie?: () => string[];
  };

  return headers.getSetCookie?.() ?? [
    response.headers.get("set-cookie") ?? "",
  ];
}

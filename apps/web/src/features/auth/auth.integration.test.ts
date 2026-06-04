import { eq } from "drizzle-orm";
import { describe, expect, test } from "vitest";

import { accounts, users } from "@/db/schema";
import { createMigratedPgliteDatabase } from "@/test/migrated-pglite";
import { createPodTrackerAuth } from "./server";

describe("Better Auth integration", () => {
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
});

function authRequest(
  path: string,
  body?: Record<string, string>,
  cookie?: string,
) {
  return new Request(`http://127.0.0.1:3100${path}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      origin: "http://127.0.0.1:3100",
      ...(cookie ? { cookie } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
}

function getCookieHeader(response: Response) {
  const headers = response.headers as Headers & {
    getSetCookie?: () => string[];
  };
  const setCookies = headers.getSetCookie?.() ?? [
    response.headers.get("set-cookie") ?? "",
  ];

  return setCookies
    .filter(Boolean)
    .map((cookie) => cookie.split(";")[0])
    .join("; ");
}

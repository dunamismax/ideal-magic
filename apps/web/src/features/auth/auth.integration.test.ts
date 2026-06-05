import { asc, eq } from "drizzle-orm";
import { afterEach, describe, expect, test, vi } from "vitest";

import { accounts, auditEvents, users, verifications } from "@/db/schema";
import { createMigratedPgliteDatabase } from "@/test/migrated-pglite";
import type { TransactionalEmail } from "@/features/email/smtp2go";
import { createPodTrackerAuth } from "./server";

const pgliteAuthTestTimeout = 10_000;

describe("Better Auth integration", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  test(
    "signs up, sends verification email, verifies, logs out, and logs back in",
    async () => {
      const { db } = await createMigratedPgliteDatabase();
      const sentEmail = createFakeEmailDelivery();
      const auth = createPodTrackerAuth(db, {
        baseURL: "http://127.0.0.1:3100",
        emailDelivery: sentEmail.delivery,
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
      expect(signupCookie).not.toContain("pod-tracker.session_token=");
      expect(sentEmail.messages).toHaveLength(1);
      expect(sentEmail.messages[0]).toMatchObject({
        to: email,
        subject: "Verify your Pod Tracker account",
      });

      const signupSession = await auth.api.getSession({
        headers: new Headers({ cookie: signupCookie }),
      });

      expect(signupSession).toBeNull();

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

      const verificationResponse = await auth.handler(
        authGetRequest(getEmailLink(sentEmail.messages[0])),
      );
      const verifiedCookie = getCookieHeader(verificationResponse);
      const verifiedSession = await auth.api.getSession({
        headers: new Headers({ cookie: verifiedCookie }),
      });
      const [verifiedUserRow] = await db
        .select({
          emailVerified: users.emailVerified,
        })
        .from(users)
        .where(eq(users.email, email));

      expect(verificationResponse.status).toBe(302);
      expect(verifiedCookie).toContain("pod-tracker.session_token=");
      expect(verifiedSession?.user).toMatchObject({
        email,
        name: "Riley Chen",
      });
      expect(verifiedUserRow?.emailVerified).toBe(true);

      const signoutResponse = await auth.handler(
        authRequest("/api/auth/sign-out", undefined, verifiedCookie),
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

      const auditRows = await db
        .select({
          action: auditEvents.action,
          actorUserId: auditEvents.actorUserId,
          targetType: auditEvents.targetType,
          targetId: auditEvents.targetId,
          metadata: auditEvents.metadata,
        })
        .from(auditEvents)
        .orderBy(asc(auditEvents.createdAt), asc(auditEvents.id));

      expect(auditRows).toHaveLength(6);
      expect(auditRows).toEqual(
        expect.arrayContaining([
          {
            action: "auth.signup",
            actorUserId: userRow.id,
            targetType: "user",
            targetId: userRow.id,
            metadata: { provider: "credential", source: "signup" },
          },
          {
            action: "auth.email_verification_requested",
            actorUserId: null,
            targetType: "user",
            targetId: userRow.id,
            metadata: { source: "signup" },
          },
          {
            action: "auth.login",
            actorUserId: userRow.id,
            targetType: "session",
            targetId: expect.any(String),
            metadata: { remembered: true, source: "email_verification" },
          },
          {
            action: "auth.email_verified",
            actorUserId: userRow.id,
            targetType: "user",
            targetId: userRow.id,
            metadata: { source: "email_verification" },
          },
          {
            action: "auth.logout",
            actorUserId: userRow.id,
            targetType: "session",
            targetId: expect.any(String),
            metadata: { remembered: true, source: "signout" },
          },
          {
            action: "auth.login",
            actorUserId: userRow.id,
            targetType: "session",
            targetId: expect.any(String),
            metadata: { remembered: true, source: "password" },
          },
        ]),
      );
      expect(JSON.stringify(auditRows)).not.toContain(email);
      expect(JSON.stringify(auditRows)).not.toContain(password);
    },
    pgliteAuthTestTimeout,
  );

  test("resends verification email when an unverified user tries to log in", async () => {
    const { db } = await createMigratedPgliteDatabase();
    const sentEmail = createFakeEmailDelivery();
    const auth = createPodTrackerAuth(db, {
      baseURL: "http://127.0.0.1:3100",
      emailDelivery: sentEmail.delivery,
      secret: "pod-tracker-unverified-login-test-secret",
    });
    const email = "unverified-login@example.test";

    await auth.handler(
      authRequest("/api/auth/sign-up/email", {
        email,
        password: "correct-horse-battery",
        name: "Unverified Login",
      }),
    );

    const loginResponse = await auth.handler(
      authRequest("/api/auth/sign-in/email", {
        email,
        password: "correct-horse-battery",
      }),
    );

    expect(loginResponse.status).not.toBe(200);
    expect(sentEmail.messages).toHaveLength(2);
    expect(sentEmail.messages[1]).toMatchObject({
      to: email,
      subject: "Verify your Pod Tracker account",
    });
  });

  test("requests password reset without sending mail for unknown users", async () => {
    const { db } = await createMigratedPgliteDatabase();
    const sentEmail = createFakeEmailDelivery();
    const auth = createPodTrackerAuth(db, {
      baseURL: "http://127.0.0.1:3100",
      emailDelivery: sentEmail.delivery,
      secret: "pod-tracker-reset-unknown-test-secret",
    });

    const response = await auth.handler(
      authRequest("/api/auth/request-password-reset", {
        email: "missing@example.test",
        redirectTo: "/reset-password",
      }),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ status: true });
    expect(sentEmail.messages).toHaveLength(0);
    expect(await db.select().from(auditEvents)).toHaveLength(0);
  });

  test("sends password reset email and accepts the reset token", async () => {
    const { db } = await createMigratedPgliteDatabase();
    const sentEmail = createFakeEmailDelivery();
    const auth = createPodTrackerAuth(db, {
      baseURL: "http://127.0.0.1:3100",
      emailDelivery: sentEmail.delivery,
      secret: "pod-tracker-password-reset-test-secret",
    });
    const email = "reset@example.test";
    const oldPassword = "correct-horse-battery";
    const newPassword = "fresh-correct-horse-battery";

    await auth.handler(
      authRequest("/api/auth/sign-up/email", {
        email,
        password: oldPassword,
        name: "Reset User",
      }),
    );
    await auth.handler(authGetRequest(getEmailLink(sentEmail.messages[0])));

    const resetResponse = await auth.handler(
      authRequest("/api/auth/request-password-reset", {
        email,
        redirectTo: "/reset-password",
      }),
    );

    expect(resetResponse.status).toBe(200);
    expect(sentEmail.messages.at(-1)).toMatchObject({
      to: email,
      subject: "Reset your Pod Tracker password",
    });

    const resetCallbackResponse = await auth.handler(
      authGetRequest(getEmailLink(sentEmail.messages.at(-1))),
    );
    const resetCallbackLocation =
      resetCallbackResponse.headers.get("location") ?? "";
    const resetToken = new URL(resetCallbackLocation).searchParams.get("token");

    expect(resetCallbackResponse.status).toBe(302);
    expect(resetToken).toBeTruthy();
    if (!resetToken) {
      throw new Error("Expected reset callback to include a token.");
    }

    const passwordResponse = await auth.handler(
      authRequest("/api/auth/reset-password", {
        newPassword,
        token: resetToken,
      }),
    );

    expect(passwordResponse.status).toBe(200);

    const oldLoginResponse = await auth.handler(
      authRequest("/api/auth/sign-in/email", {
        email,
        password: oldPassword,
      }),
    );
    const newLoginResponse = await auth.handler(
      authRequest("/api/auth/sign-in/email", {
        email,
        password: newPassword,
      }),
    );

    expect(oldLoginResponse.status).not.toBe(200);
    expect(newLoginResponse.status).toBe(200);

    const auditRows = await db
      .select({
        action: auditEvents.action,
        targetId: auditEvents.targetId,
        metadata: auditEvents.metadata,
      })
      .from(auditEvents)
      .orderBy(asc(auditEvents.createdAt), asc(auditEvents.id));
    const auditActions = auditRows.map((row) => row.action);

    expect(auditActions).toContain("auth.password_reset_requested");
    expect(auditActions).toContain("auth.password_reset_completed");
    expect(
      auditRows.filter((row) => row.action === "auth.password_reset_requested"),
    ).toEqual([
      {
        action: "auth.password_reset_requested",
        targetId: expect.any(String),
        metadata: { source: "password_reset" },
      },
    ]);
    expect(
      auditRows.filter((row) => row.action === "auth.password_reset_completed"),
    ).toEqual([
      {
        action: "auth.password_reset_completed",
        targetId: expect.any(String),
        metadata: { source: "password_reset" },
      },
    ]);
    expect(JSON.stringify(auditRows)).not.toContain(email);
    expect(JSON.stringify(auditRows)).not.toContain(oldPassword);
    expect(JSON.stringify(auditRows)).not.toContain(newPassword);
    expect(JSON.stringify(auditRows)).not.toContain(resetToken);
  });

  test("confirms email changes before updating the account email", async () => {
    const { db } = await createMigratedPgliteDatabase();
    const sentEmail = createFakeEmailDelivery();
    const auth = createPodTrackerAuth(db, {
      baseURL: "http://127.0.0.1:3100",
      emailDelivery: sentEmail.delivery,
      secret: "pod-tracker-email-change-test-secret",
    });
    const currentEmail = "current-email@example.test";
    const nextEmail = "next-email@example.test";

    await auth.handler(
      authRequest("/api/auth/sign-up/email", {
        email: currentEmail,
        password: "correct-horse-battery",
        name: "Email Change",
      }),
    );
    const verificationResponse = await auth.handler(
      authGetRequest(getEmailLink(sentEmail.messages[0])),
    );
    const sessionCookie = getCookieHeader(verificationResponse);

    const changeResponse = await auth.handler(
      authRequest(
        "/api/auth/change-email",
        {
          newEmail: nextEmail,
          callbackURL: "/account",
        },
        sessionCookie,
      ),
    );

    expect(changeResponse.status).toBe(200);
    expect(sentEmail.messages.at(-1)).toMatchObject({
      to: currentEmail,
      subject: "Confirm your Pod Tracker email change",
    });

    const currentConfirmationResponse = await auth.handler(
      authGetRequest(getEmailLink(sentEmail.messages.at(-1)), sessionCookie),
    );

    expect(currentConfirmationResponse.status).toBe(302);
    expect(sentEmail.messages.at(-1)).toMatchObject({
      to: nextEmail,
      subject: "Verify your Pod Tracker account",
    });

    const newEmailVerificationResponse = await auth.handler(
      authGetRequest(getEmailLink(sentEmail.messages.at(-1)), sessionCookie),
    );
    const [updatedUser] = await db
      .select({
        email: users.email,
        emailVerified: users.emailVerified,
      })
      .from(users)
      .where(eq(users.email, nextEmail));

    expect(newEmailVerificationResponse.status).toBe(302);
    expect(updatedUser).toMatchObject({
      email: nextEmail,
      emailVerified: true,
    });

    const auditRows = await db
      .select({
        action: auditEvents.action,
        actorUserId: auditEvents.actorUserId,
        targetType: auditEvents.targetType,
        targetId: auditEvents.targetId,
        metadata: auditEvents.metadata,
      })
      .from(auditEvents)
      .orderBy(asc(auditEvents.createdAt), asc(auditEvents.id));
    const emailChangeRows = auditRows.filter(
      (row) => row.action === "auth.email_change_requested",
    );
    const emailVerifiedRows = auditRows.filter(
      (row) => row.action === "auth.email_verified",
    );

    expect(emailChangeRows).toEqual([
      {
        action: "auth.email_change_requested",
        actorUserId: expect.any(String),
        targetType: "user",
        targetId: expect.any(String),
        metadata: { source: "email_change" },
      },
    ]);
    expect(emailVerifiedRows.at(-1)).toMatchObject({
      action: "auth.email_verified",
      actorUserId: expect.any(String),
      targetType: "user",
      targetId: expect.any(String),
      metadata: { source: "email_verification" },
    });
    expect(JSON.stringify(auditRows)).not.toContain(currentEmail);
    expect(JSON.stringify(auditRows)).not.toContain(nextEmail);
  });

  test("does not leave reset verifications after password reset", async () => {
    const { db } = await createMigratedPgliteDatabase();
    const sentEmail = createFakeEmailDelivery();
    const auth = createPodTrackerAuth(db, {
      baseURL: "http://127.0.0.1:3100",
      emailDelivery: sentEmail.delivery,
      secret: "pod-tracker-reset-cleanup-test-secret",
    });
    const email = "reset-cleanup@example.test";

    await auth.handler(
      authRequest("/api/auth/sign-up/email", {
        email,
        password: "correct-horse-battery",
        name: "Reset Cleanup",
      }),
    );
    await auth.handler(authGetRequest(getEmailLink(sentEmail.messages[0])));
    await auth.handler(
      authRequest("/api/auth/request-password-reset", {
        email,
        redirectTo: "/reset-password",
      }),
    );
    const resetCallbackResponse = await auth.handler(
      authGetRequest(getEmailLink(sentEmail.messages.at(-1))),
    );
    const resetToken = new URL(
      resetCallbackResponse.headers.get("location") ?? "",
    ).searchParams.get("token");

    if (!resetToken) {
      throw new Error("Expected reset callback to include a token.");
    }

    await auth.handler(
      authRequest("/api/auth/reset-password", {
        newPassword: "fresh-correct-horse-battery",
        token: resetToken,
      }),
    );

    const rows = await db.select().from(verifications);

    expect(rows).toHaveLength(0);
  });

  test("sets hardened production session cookie attributes", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const { db } = await createMigratedPgliteDatabase();
    const sentEmail = createFakeEmailDelivery();
    const auth = createPodTrackerAuth(db, {
      baseURL: "https://pod-tracker.example.test",
      emailDelivery: sentEmail.delivery,
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
    const verificationResponse = await auth.handler(
      authGetRequest(getEmailLink(sentEmail.messages[0])),
    );
    const sessionCookie = getSetCookies(verificationResponse).find((cookie) =>
      cookie.includes("pod-tracker.session_token="),
    );

    expect(signupResponse.status).toBe(200);
    expect(verificationResponse.status).toBe(302);
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

function authGetRequest(url: string, cookie?: string) {
  return new Request(url, {
    method: "GET",
    headers: {
      origin: new URL(url).origin,
      ...(cookie ? { cookie } : {}),
    },
  });
}

function createFakeEmailDelivery() {
  const messages: TransactionalEmail[] = [];

  return {
    messages,
    delivery: {
      async send(message: TransactionalEmail) {
        messages.push(message);
      },
    },
  };
}

function getEmailLink(message: TransactionalEmail | undefined) {
  const match = message?.textBody.match(/https?:\/\/\S+/);

  if (!match) {
    throw new Error("Expected email message to contain a link.");
  }

  return match[0];
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

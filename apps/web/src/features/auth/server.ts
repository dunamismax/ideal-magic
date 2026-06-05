import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import type {
  Account,
  GenericEndpointContext,
  Session,
} from "better-auth";
import { betterAuth, type BetterAuthOptions } from "better-auth/minimal";
import { nextCookies } from "better-auth/next-js";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { recordAuditEvent, type AuditEventAction } from "@/db/audit";
import { createDatabase, type AppDatabase } from "@/db/client";
import * as schema from "@/db/schema";
import type { AuthEmailDelivery } from "@/features/auth/email";
import {
  sendAccountVerificationEmail,
  sendChangeEmailConfirmation,
  sendPasswordResetEmail,
} from "@/features/auth/email";
import { createSmtp2goEmailDeliveryFromEnv } from "@/features/email/smtp2go";
import { getAppBaseUrl, getTrustedOrigins } from "@/features/security/origin";

type AuthDatabase = Pick<
  AppDatabase,
  "select" | "insert" | "update" | "delete"
>;

type CreateAuthOptions = {
  baseURL?: string;
  emailDelivery?: AuthEmailDelivery;
  secret?: string;
  useNextCookies?: boolean;
};

type AuthAuditEventInput = {
  action: AuditEventAction;
  actorUserId?: string | null;
  targetType: string;
  targetId?: string | null;
  metadata?: Record<string, unknown>;
};

let authSingleton: ReturnType<typeof createPodTrackerAuth> | null = null;

export function createPodTrackerAuth(
  db: AuthDatabase,
  options: CreateAuthOptions = {},
) {
  const getEmailDelivery = () =>
    options.emailDelivery ?? createSmtp2goEmailDeliveryFromEnv();
  const pendingAuthAuditEvents: AuthAuditEventInput[] = [];
  const queueAuthAuditEvent = (input: AuthAuditEventInput) => {
    pendingAuthAuditEvents.push(input);
  };
  const flushPendingAuthAuditEvents = async () => {
    const events = pendingAuthAuditEvents.splice(0);

    for (const event of events) {
      await recordAuthAuditEvent(db, event);
    }
  };

  const authOptions = {
    appName: "Pod Tracker",
    baseURL: options.baseURL ?? getAppBaseUrl(),
    secret: options.secret ?? getAuthSecret(),
    trustedOrigins: getTrustedOrigins(options.baseURL ?? getAppBaseUrl()),
    database: drizzleAdapter(db, {
      provider: "pg",
      transaction: true,
      schema: {
        ...schema,
        user: schema.users,
        session: schema.sessions,
        account: schema.accounts,
        verification: schema.verifications,
      },
    }),
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: true,
      minPasswordLength: 10,
      maxPasswordLength: 128,
      autoSignIn: false,
      resetPasswordTokenExpiresIn: 60 * 60,
      revokeSessionsOnPasswordReset: true,
      sendResetPassword: async ({ user, url }) => {
        await sendPasswordResetEmail(getEmailDelivery(), {
          to: user.email,
          url,
        });
        queueAuthAuditEvent({
          action: "auth.password_reset_requested",
          actorUserId: null,
          targetType: "user",
          targetId: user.id,
          metadata: {
            source: "password_reset",
          },
        });
      },
      onPasswordReset: async ({ user }) => {
        queueAuthAuditEvent({
          action: "auth.password_reset_completed",
          actorUserId: user.id,
          targetType: "user",
          targetId: user.id,
          metadata: {
            source: "password_reset",
          },
        });
      },
    },
    emailVerification: {
      sendOnSignUp: true,
      sendOnSignIn: true,
      autoSignInAfterVerification: true,
      expiresIn: 60 * 60 * 24,
      sendVerificationEmail: async ({ user, url }, request) => {
        await sendAccountVerificationEmail(getEmailDelivery(), {
          to: user.email,
          url,
        });
        queueAuthAuditEvent({
          action: "auth.email_verification_requested",
          actorUserId: null,
          targetType: "user",
          targetId: user.id,
          metadata: {
            source: getAuthAuditSourceFromRequest(request),
          },
        });
      },
      afterEmailVerification: async (user, request) => {
        queueAuthAuditEvent({
          action: "auth.email_verified",
          actorUserId: user.id,
          targetType: "user",
          targetId: user.id,
          metadata: {
            source: getAuthAuditSourceFromRequest(request),
          },
        });
      },
    },
    user: {
      changeEmail: {
        enabled: true,
        sendChangeEmailConfirmation: async (
          { user, newEmail, url },
          request,
        ) => {
          await sendChangeEmailConfirmation(getEmailDelivery(), {
            to: user.email,
            newEmail,
            url,
          });
          queueAuthAuditEvent({
            action: "auth.email_change_requested",
            actorUserId: user.id,
            targetType: "user",
            targetId: user.id,
            metadata: {
              source: getAuthAuditSourceFromRequest(request),
            },
          });
        },
      },
    },
    session: {
      expiresIn: 60 * 60 * 24 * 7,
      updateAge: 60 * 60 * 24,
    },
    advanced: {
      cookiePrefix: "pod-tracker",
      useSecureCookies: process.env.NODE_ENV === "production",
      disableCSRFCheck: false,
      disableOriginCheck: false,
      defaultCookieAttributes: {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
      },
      database: {
        generateId: "uuid",
      },
    },
    databaseHooks: {
      account: {
        create: {
          after: async (account, context) => {
            if (
              account.providerId !== "credential" ||
              getAuthAuditSourceFromContext(context) !== "signup"
            ) {
              return;
            }

            await recordAuthAuditEvent(db, {
              action: "auth.signup",
              actorUserId: account.userId,
              targetType: "user",
              targetId: account.userId,
              metadata: getAccountAuditMetadata(account, context),
            });
          },
        },
      },
      session: {
        create: {
          after: async (session, context) => {
            await recordAuthAuditEvent(db, {
              action: "auth.login",
              actorUserId: session.userId,
              targetType: "session",
              targetId: session.id,
              metadata: getSessionAuditMetadata(session, context),
            });
          },
        },
        delete: {
          after: async (session, context) => {
            await recordAuthAuditEvent(db, {
              action: "auth.logout",
              actorUserId: session.userId,
              targetType: "session",
              targetId: session.id,
              metadata: getSessionAuditMetadata(session, context),
            });
          },
        },
      },
    },
    hooks: {
      after: async () => {
        await flushPendingAuthAuditEvents();
        return {};
      },
    },
    plugins: options.useNextCookies ? [nextCookies()] : [],
  } satisfies BetterAuthOptions;

  return betterAuth(authOptions);
}

export function getAuth() {
  authSingleton ??= createPodTrackerAuth(createDatabase(), {
    useNextCookies: true,
  });

  return authSingleton;
}

export async function getServerSession() {
  return getAuth().api.getSession({
    headers: await headers(),
  });
}

export async function requireServerSession(nextPath: string) {
  const session = await getServerSession();

  if (!session) {
    redirect(getLoginRedirectPath(nextPath));
  }

  return session;
}

export function getLoginRedirectPath(nextPath: string) {
  const safeNextPath =
    nextPath.startsWith("/") && !nextPath.startsWith("//")
      ? nextPath
      : "/account";

  return `/login?next=${encodeURIComponent(safeNextPath)}`;
}

function getAuthSecret() {
  if (process.env.BETTER_AUTH_SECRET) {
    return process.env.BETTER_AUTH_SECRET;
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error("BETTER_AUTH_SECRET is required in production");
  }

  return "pod-tracker-local-development-auth-secret";
}

async function recordAuthAuditEvent(
  db: AuthDatabase,
  input: AuthAuditEventInput,
) {
  await recordAuditEvent(db, {
    action: input.action,
    actorUserId: input.actorUserId ?? null,
    targetType: input.targetType,
    targetId: input.targetId ?? null,
    metadata: input.metadata,
  });
}

function getAccountAuditMetadata(
  account: Account,
  context: GenericEndpointContext | null,
) {
  return {
    provider: account.providerId,
    source: getAuthAuditSourceFromContext(context),
  };
}

function getSessionAuditMetadata(
  session: Session,
  context: GenericEndpointContext | null,
) {
  return {
    remembered: session.expiresAt.getTime() > Date.now() + 24 * 60 * 60 * 1000,
    source: getAuthAuditSourceFromContext(context),
  };
}

function getAuthAuditSourceFromContext(
  context: GenericEndpointContext | null,
) {
  return getAuthAuditSource(context?.path);
}

function getAuthAuditSourceFromRequest(
  requestOrUrl: Request | string | undefined,
) {
  if (!requestOrUrl) {
    return "unknown";
  }

  const url = typeof requestOrUrl === "string" ? requestOrUrl : requestOrUrl.url;

  try {
    return getAuthAuditSource(new URL(url).pathname);
  } catch {
    return "unknown";
  }
}

function getAuthAuditSource(path: string | undefined) {
  if (!path) {
    return "unknown";
  }

  const normalizedPath = path.replace(/^\/api\/auth/, "");

  switch (normalizedPath) {
    case "/sign-up/email":
      return "signup";
    case "/sign-in/email":
      return "password";
    case "/sign-out":
      return "signout";
    case "/request-password-reset":
    case "/reset-password":
      return "password_reset";
    case "/send-verification-email":
      return "manual";
    case "/verify-email":
      return "email_verification";
    case "/change-email":
      return "email_change";
    default:
      return "unknown";
  }
}

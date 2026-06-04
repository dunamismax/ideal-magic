import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { betterAuth, type BetterAuthOptions } from "better-auth/minimal";
import { nextCookies } from "better-auth/next-js";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { createDatabase, type AppDatabase } from "@/db/client";
import * as schema from "@/db/schema";

type AuthDatabase = Pick<
  AppDatabase,
  "select" | "insert" | "update" | "delete"
>;

type CreateAuthOptions = {
  baseURL?: string;
  secret?: string;
  useNextCookies?: boolean;
};

let authSingleton: ReturnType<typeof createPodTrackerAuth> | null = null;

export function createPodTrackerAuth(
  db: AuthDatabase,
  options: CreateAuthOptions = {},
) {
  const authOptions = {
    appName: "Pod Tracker",
    baseURL: options.baseURL ?? getAuthBaseUrl(),
    secret: options.secret ?? getAuthSecret(),
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
      requireEmailVerification: false,
      autoSignIn: true,
    },
    advanced: {
      cookiePrefix: "pod-tracker",
      useSecureCookies: process.env.NODE_ENV === "production",
      database: {
        generateId: "uuid",
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

function getAuthBaseUrl() {
  return (
    process.env.BETTER_AUTH_URL ??
    process.env.NEXT_PUBLIC_APP_URL ??
    "http://localhost:3000"
  );
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

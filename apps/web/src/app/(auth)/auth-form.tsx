"use client";

import { AlertCircle, CheckCircle2, LogIn, UserPlus } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { fieldControlClassName, FormField } from "@/components/ui/form-field";
import { authClient } from "@/features/auth/client";

type AuthMode = "login" | "signup";

export function AuthForm({ mode }: { mode: AuthMode }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const nextPath = useMemo(() => {
    const rawNextPath = searchParams.get("next");

    return rawNextPath?.startsWith("/") ? rawNextPath : "/account";
  }, [searchParams]);

  async function submitAuthForm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const formData = new FormData(event.currentTarget);
    const email = String(formData.get("email") ?? "")
      .trim()
      .toLowerCase();
    const password = String(formData.get("password") ?? "");
    const name = String(formData.get("name") ?? "").trim();

    setError(null);
    setSuccess(null);
    setIsSubmitting(true);

    const result =
      mode === "signup"
        ? await authClient.signUp.email({
            email,
            password,
            name,
            callbackURL: nextPath,
          })
        : await authClient.signIn.email({
            email,
            password,
            callbackURL: nextPath,
          });

    setIsSubmitting(false);

    if (result.error) {
      setError(getAuthErrorMessage(result.error.message));
      return;
    }

    if (mode === "signup") {
      setSuccess("Check your email to verify your account.");
      return;
    }

    router.push(nextPath);
    router.refresh();
  }

  const isSignup = mode === "signup";
  const title = isSignup ? "Create Account" : "Log In";
  const Icon = isSignup ? UserPlus : LogIn;

  return (
    <form
      className="grid gap-4 rounded-panel border border-border bg-surface p-4 shadow-sm sm:p-5"
      onSubmit={submitAuthForm}
    >
      <div className="flex items-center gap-3">
        <span className="flex size-10 items-center justify-center rounded-control bg-accent text-accent-foreground">
          <Icon className="size-5" aria-hidden="true" />
        </span>
        <div>
          <h2 className="text-xl font-bold">{title}</h2>
          <p className="text-sm font-medium text-muted">
            {isSignup ? "Start a self-hosted table." : "Return to your table."}
          </p>
        </div>
      </div>

      {error ? (
        <div
          className="flex items-start gap-2 rounded-control border border-danger/40 bg-danger/10 p-3 text-sm font-semibold text-danger"
          role="alert"
        >
          <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <span>{error}</span>
        </div>
      ) : null}

      {success ? (
        <div
          className="flex items-start gap-2 rounded-control border border-accent/40 bg-accent/10 p-3 text-sm font-semibold text-accent"
          role="status"
        >
          <CheckCircle2 className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <span>{success}</span>
        </div>
      ) : null}

      {isSignup ? (
        <FormField label="Name">
          <input
            className={fieldControlClassName}
            name="name"
            autoComplete="name"
            minLength={1}
            required
          />
        </FormField>
      ) : null}

      <FormField label="Email">
        <input
          className={fieldControlClassName}
          name="email"
          type="email"
          autoComplete="email"
          required
        />
      </FormField>

      <FormField label="Password">
        <input
          className={fieldControlClassName}
          name="password"
          type="password"
          autoComplete={isSignup ? "new-password" : "current-password"}
          minLength={10}
          required
        />
      </FormField>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Button disabled={isSubmitting} type="submit" variant="primary">
          <Icon className="size-4" aria-hidden="true" />
          {isSubmitting ? "Working" : title}
        </Button>
        <Link
          className="text-sm font-bold text-accent hover:text-accent-hover"
          href={isSignup ? "/login" : "/signup"}
        >
          {isSignup ? "Log in instead" : "Create an account"}
        </Link>
      </div>

      {!isSignup ? (
        <div className="flex flex-wrap gap-3 text-sm font-bold">
          <Link
            className="text-accent hover:text-accent-hover"
            href="/forgot-password"
          >
            Forgot password
          </Link>
          <Link
            className="text-accent hover:text-accent-hover"
            href="/verify-email"
          >
            Resend verification
          </Link>
        </div>
      ) : null}
    </form>
  );
}

function getAuthErrorMessage(message: string | undefined) {
  if (message?.toLowerCase().includes("verified")) {
    return "Check your email to verify your account before logging in.";
  }

  return message ?? "Authentication failed.";
}

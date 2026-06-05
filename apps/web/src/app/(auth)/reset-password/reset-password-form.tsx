"use client";

import { AlertCircle, CheckCircle2, KeyRound } from "lucide-react";
import Link from "next/link";
import { FormEvent, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { fieldControlClassName, FormField } from "@/components/ui/form-field";
import { postAuthJson } from "@/features/auth/api-client";

export function ResetPasswordForm({
  token,
  tokenError,
}: {
  token: string | null;
  tokenError: string | null;
}) {
  const [error, setError] = useState<string | null>(
    tokenError ? "The reset link is invalid or expired." : null,
  );
  const [success, setSuccess] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const canSubmit = useMemo(() => Boolean(token) && !success, [success, token]);

  async function resetPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!token) {
      setError("The reset link is invalid or expired.");
      return;
    }

    const form = event.currentTarget;
    const formData = new FormData(form);
    const newPassword = String(formData.get("newPassword") ?? "");

    setError(null);
    setSuccess(null);
    setIsSubmitting(true);

    const result = await postAuthJson<{ status: boolean }>("/reset-password", {
      newPassword,
      token,
    });

    setIsSubmitting(false);

    if (result.error) {
      setError("The reset link is invalid or expired.");
      return;
    }

    setSuccess("Your password has been updated.");
    form.reset();
  }

  return (
    <form
      className="grid gap-4 rounded-panel border border-border bg-surface p-4 shadow-sm sm:p-5"
      onSubmit={resetPassword}
    >
      <div className="flex items-center gap-3">
        <span className="flex size-10 items-center justify-center rounded-control bg-accent text-accent-foreground">
          <KeyRound className="size-5" aria-hidden="true" />
        </span>
        <div>
          <h2 className="text-xl font-bold">New Password</h2>
          <p className="text-sm font-medium text-muted">
            Choose a new account password.
          </p>
        </div>
      </div>

      {error ? <AuthNotice tone="error" message={error} /> : null}
      {success ? <AuthNotice tone="success" message={success} /> : null}

      <FormField label="New password">
        <input
          className={fieldControlClassName}
          name="newPassword"
          type="password"
          autoComplete="new-password"
          minLength={10}
          required
          disabled={!canSubmit}
        />
      </FormField>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Button
          disabled={isSubmitting || !canSubmit}
          type="submit"
          variant="primary"
        >
          <KeyRound className="size-4" aria-hidden="true" />
          {isSubmitting ? "Updating" : "Update password"}
        </Button>
        <Link className="text-sm font-bold text-accent hover:text-teal-800" href="/login">
          Back to login
        </Link>
      </div>
    </form>
  );
}

function AuthNotice({
  tone,
  message,
}: {
  tone: "error" | "success";
  message: string;
}) {
  const isError = tone === "error";
  const Icon = isError ? AlertCircle : CheckCircle2;

  return (
    <div
      className={
        isError
          ? "flex items-start gap-2 rounded-control border border-danger/40 bg-danger/10 p-3 text-sm font-semibold text-danger"
          : "flex items-start gap-2 rounded-control border border-accent/40 bg-accent/10 p-3 text-sm font-semibold text-accent"
      }
      role={isError ? "alert" : "status"}
    >
      <Icon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      <span>{message}</span>
    </div>
  );
}

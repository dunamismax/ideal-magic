"use client";

import { AlertCircle, CheckCircle2, MailCheck } from "lucide-react";
import Link from "next/link";
import { FormEvent, useState } from "react";

import { Button } from "@/components/ui/button";
import { fieldControlClassName, FormField } from "@/components/ui/form-field";
import { postAuthJson } from "@/features/auth/api-client";

export function VerifyEmailForm() {
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function sendVerification(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const form = event.currentTarget;
    const formData = new FormData(form);
    const email = String(formData.get("email") ?? "")
      .trim()
      .toLowerCase();

    setError(null);
    setSuccess(null);
    setIsSubmitting(true);

    const result = await postAuthJson<{ status: boolean }>(
      "/send-verification-email",
      {
        email,
        callbackURL: "/account",
      },
    );

    setIsSubmitting(false);

    if (result.error) {
      setError(result.error);
      return;
    }

    setSuccess("If verification is available, check your email.");
    form.reset();
  }

  return (
    <form
      className="grid gap-4 rounded-panel border border-border bg-surface p-4 shadow-sm sm:p-5"
      onSubmit={sendVerification}
    >
      <div className="flex items-center gap-3">
        <span className="flex size-10 items-center justify-center rounded-control bg-accent text-accent-foreground">
          <MailCheck className="size-5" aria-hidden="true" />
        </span>
        <div>
          <h2 className="text-xl font-bold">Verify Email</h2>
          <p className="text-sm font-medium text-muted">
            Send a new account verification link.
          </p>
        </div>
      </div>

      {error ? <AuthNotice tone="error" message={error} /> : null}
      {success ? <AuthNotice tone="success" message={success} /> : null}

      <FormField label="Email">
        <input
          className={fieldControlClassName}
          name="email"
          type="email"
          autoComplete="email"
          required
        />
      </FormField>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Button disabled={isSubmitting} type="submit" variant="primary">
          <MailCheck className="size-4" aria-hidden="true" />
          {isSubmitting ? "Sending" : "Send verification"}
        </Button>
        <Link
          className="text-sm font-bold text-accent hover:text-accent-hover"
          href="/login"
        >
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

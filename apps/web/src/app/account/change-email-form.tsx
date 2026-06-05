"use client";

import { AlertCircle, CheckCircle2, MailCheck } from "lucide-react";
import { FormEvent, useState } from "react";

import { Button } from "@/components/ui/button";
import { fieldControlClassName, FormField } from "@/components/ui/form-field";
import { postAuthJson } from "@/features/auth/api-client";

export function ChangeEmailForm() {
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function requestEmailChange(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const form = event.currentTarget;
    const formData = new FormData(form);
    const newEmail = String(formData.get("newEmail") ?? "")
      .trim()
      .toLowerCase();

    setError(null);
    setSuccess(null);
    setIsSubmitting(true);

    const result = await postAuthJson<{ status: boolean }>("/change-email", {
      newEmail,
      callbackURL: "/account",
    });

    setIsSubmitting(false);

    if (result.error) {
      setError(result.error);
      return;
    }

    setSuccess("Check your current email to confirm the change.");
    form.reset();
  }

  return (
    <form className="grid gap-3" onSubmit={requestEmailChange}>
      {error ? <AuthNotice tone="error" message={error} /> : null}
      {success ? <AuthNotice tone="success" message={success} /> : null}

      <FormField label="New email">
        <input
          className={fieldControlClassName}
          name="newEmail"
          type="email"
          autoComplete="email"
          required
        />
      </FormField>

      <Button disabled={isSubmitting} type="submit" variant="secondary">
        <MailCheck className="size-4" aria-hidden="true" />
        {isSubmitting ? "Sending" : "Change email"}
      </Button>
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

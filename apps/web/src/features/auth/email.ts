import type {
  TransactionalEmail,
  TransactionalEmailDelivery,
} from "@/features/email/smtp2go";

type AuthEmailInput = {
  to: string;
  url: string;
};

type ChangeEmailConfirmationInput = AuthEmailInput & {
  newEmail: string;
};

export type AuthEmailDelivery = TransactionalEmailDelivery;

export function sendAccountVerificationEmail(
  delivery: AuthEmailDelivery,
  input: AuthEmailInput,
) {
  return delivery.send(
    buildLinkEmail({
      to: input.to,
      subject: "Verify your Pod Tracker account",
      intro: "Verify your Pod Tracker account to finish signing in.",
      action: "Verify account",
      url: input.url,
    }),
  );
}

export function sendPasswordResetEmail(
  delivery: AuthEmailDelivery,
  input: AuthEmailInput,
) {
  return delivery.send(
    buildLinkEmail({
      to: input.to,
      subject: "Reset your Pod Tracker password",
      intro: "Use this link to choose a new Pod Tracker password.",
      action: "Reset password",
      url: input.url,
    }),
  );
}

export function sendChangeEmailConfirmation(
  delivery: AuthEmailDelivery,
  input: ChangeEmailConfirmationInput,
) {
  return delivery.send(
    buildLinkEmail({
      to: input.to,
      subject: "Confirm your Pod Tracker email change",
      intro: `Confirm the request to change your Pod Tracker email to ${input.newEmail}.`,
      action: "Confirm email change",
      url: input.url,
    }),
  );
}

function buildLinkEmail({
  to,
  subject,
  intro,
  action,
  url,
}: {
  to: string;
  subject: string;
  intro: string;
  action: string;
  url: string;
}): TransactionalEmail {
  return {
    to,
    subject,
    textBody: `${intro}\n\n${action}: ${url}\n\nIf you did not request this, ignore this email.`,
    htmlBody: [
      `<p>${escapeHtml(intro)}</p>`,
      `<p><a href="${escapeHtml(url)}">${escapeHtml(action)}</a></p>`,
      "<p>If you did not request this, ignore this email.</p>",
    ].join(""),
  };
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

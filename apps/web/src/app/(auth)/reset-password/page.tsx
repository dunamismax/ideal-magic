import { PageFrame } from "@/components/page-frame";
import { ResetPasswordForm } from "./reset-password-form";

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const token = firstParam(params.token);
  const error = firstParam(params.error);

  return (
    <PageFrame eyebrow="Account" title="Reset Password">
      <div className="max-w-md">
        <ResetPasswordForm token={token} tokenError={error} />
      </div>
    </PageFrame>
  );
}

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? (value[0] ?? null) : (value ?? null);
}

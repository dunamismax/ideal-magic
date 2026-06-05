import { PageFrame } from "@/components/page-frame";
import { ForgotPasswordForm } from "./forgot-password-form";

export default function ForgotPasswordPage() {
  return (
    <PageFrame eyebrow="Account" title="Reset Password">
      <div className="max-w-md">
        <ForgotPasswordForm />
      </div>
    </PageFrame>
  );
}

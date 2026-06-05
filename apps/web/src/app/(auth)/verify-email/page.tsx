import { PageFrame } from "@/components/page-frame";
import { VerifyEmailForm } from "./verify-email-form";

export default function VerifyEmailPage() {
  return (
    <PageFrame eyebrow="Account" title="Verify Email">
      <div className="max-w-md">
        <VerifyEmailForm />
      </div>
    </PageFrame>
  );
}

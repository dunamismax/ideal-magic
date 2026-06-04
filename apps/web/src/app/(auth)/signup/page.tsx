import { Suspense } from "react";

import { PageFrame } from "@/components/page-frame";
import { AuthForm } from "../auth-form";

export default function SignupPage() {
  return (
    <PageFrame eyebrow="Account" title="Create Account">
      <div className="max-w-md">
        <Suspense fallback={<AuthFormFallback title="Create Account" />}>
          <AuthForm mode="signup" />
        </Suspense>
      </div>
    </PageFrame>
  );
}

function AuthFormFallback({ title }: { title: string }) {
  return (
    <div className="rounded-panel border border-border bg-surface p-4 text-sm font-semibold shadow-sm sm:p-5">
      {title}
    </div>
  );
}

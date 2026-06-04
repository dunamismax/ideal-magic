"use client";

import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { authClient } from "@/features/auth/client";

export function LogoutButton() {
  const router = useRouter();
  const [isSigningOut, setIsSigningOut] = useState(false);

  async function signOut() {
    setIsSigningOut(true);
    await authClient.signOut({
      fetchOptions: {
        onSuccess: () => {
          router.push("/login");
          router.refresh();
        },
      },
    });
    setIsSigningOut(false);
  }

  return (
    <Button disabled={isSigningOut} onClick={signOut} variant="secondary">
      <LogOut className="size-4" aria-hidden="true" />
      {isSigningOut ? "Signing out" : "Log out"}
    </Button>
  );
}

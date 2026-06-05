"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { getAuth } from "@/features/auth/server";

export async function logoutAction() {
  await getAuth().api.signOut({
    headers: await headers(),
  });

  redirect("/login");
}

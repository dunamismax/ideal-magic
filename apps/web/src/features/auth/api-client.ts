"use client";

type AuthApiResult<T> =
  | { data: T; error: null }
  | { data: null; error: string };

export async function postAuthJson<T>(
  path: string,
  body: Record<string, string>,
): Promise<AuthApiResult<T>> {
  const response = await fetch(`/api/auth${path}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const payload = (await response.json().catch(() => null)) as {
    message?: string;
    error?: string;
  } | null;

  if (!response.ok) {
    return {
      data: null,
      error:
        payload?.message ??
        payload?.error ??
        "The request could not be completed.",
    };
  }

  return { data: payload as T, error: null };
}

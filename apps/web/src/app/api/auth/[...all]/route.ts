import { getAuth } from "@/features/auth/server";
import {
  enforceRateLimitForRequest,
  rateLimitPolicies,
  rateLimitResponse,
} from "@/features/security/rate-limit";

async function handleAuthRequest(request: Request) {
  if (request.method !== "GET") {
    try {
      await enforceRateLimitForRequest(request, rateLimitPolicies.auth, [
        "auth",
        new URL(request.url).pathname,
      ]);
    } catch (error) {
      return rateLimitResponse(
        error,
        "Too many auth attempts. Try again later.",
      );
    }
  }

  return getAuth().handler(request);
}

export {
  handleAuthRequest as DELETE,
  handleAuthRequest as GET,
  handleAuthRequest as PATCH,
  handleAuthRequest as POST,
  handleAuthRequest as PUT,
};

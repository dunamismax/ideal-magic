import { createDatabaseConnection } from "@/db/client";
import {
  createPublicGuestRsvp,
  PublicGuestRsvpValidationError,
  type PublicGuestRsvpInput,
} from "@/features/events/public-event";
import { isTrustedRequestOrigin } from "@/features/security/origin";
import {
  enforceRateLimitForRequest,
  rateLimitPolicies,
  rateLimitResponse,
} from "@/features/security/rate-limit";

export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ inviteToken: string }> },
) {
  const { inviteToken } = await params;
  let payload: PublicGuestRsvpInput;
  let connection;

  if (!isTrustedRequestOrigin(request)) {
    return Response.json(
      { error: "Guest RSVP origin is not allowed" },
      { status: 403 },
    );
  }

  try {
    await enforceRateLimitForRequest(
      request,
      rateLimitPolicies.publicGuestRsvp,
      ["public-events", "guest-rsvp", inviteToken],
    );
  } catch (error) {
    return rateLimitResponse(
      error,
      "Too many guest RSVP attempts. Try again later.",
    );
  }

  try {
    payload = (await request.json()) as PublicGuestRsvpInput;
  } catch {
    return Response.json(
      { error: "Guest RSVP payload must be valid JSON" },
      { status: 400 },
    );
  }

  try {
    connection = createDatabaseConnection();
    const result = await createPublicGuestRsvp(
      connection.db,
      inviteToken,
      payload,
    );

    if (!result) {
      return Response.json(
        { error: "Event invite not found" },
        { status: 404 },
      );
    }

    return Response.json(result, { status: 201 });
  } catch (error) {
    if (error instanceof PublicGuestRsvpValidationError) {
      return Response.json(
        {
          error: "Guest RSVP is invalid",
          fieldErrors: error.fieldErrors,
        },
        { status: 400 },
      );
    }

    console.error("Public guest RSVP write failed");

    return Response.json(
      { error: "Guest RSVP is unavailable" },
      { status: 503 },
    );
  } finally {
    await connection?.close();
  }
}

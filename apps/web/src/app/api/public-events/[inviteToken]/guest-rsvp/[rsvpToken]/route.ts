import { createDatabaseConnection } from "@/db/client";
import {
  cancelPublicGuestRsvp,
  getPublicGuestRsvp,
  PublicGuestRsvpValidationError,
  type PublicGuestRsvpInput,
  updatePublicGuestRsvp,
} from "@/features/events/public-event";
import { isTrustedRequestOrigin } from "@/features/security/origin";
import {
  enforceRateLimitForRequest,
  rateLimitPolicies,
  rateLimitResponse,
} from "@/features/security/rate-limit";
import { trackAnalyticsEvent } from "@/lib/analytics";
import { logServerError } from "@/lib/logger";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ inviteToken: string; rsvpToken: string }> },
) {
  const { inviteToken, rsvpToken } = await params;
  let connection;

  try {
    connection = createDatabaseConnection();
    const result = await getPublicGuestRsvp(
      connection.db,
      inviteToken,
      rsvpToken,
    );

    if (!result) {
      return Response.json({ error: "Guest RSVP not found" }, { status: 404 });
    }

    return Response.json(result);
  } catch (error) {
    logServerError("public_guest_rsvp_lookup_failed", error, {
      component: "public-events",
    });

    return Response.json(
      { error: "Guest RSVP is unavailable" },
      { status: 503 },
    );
  } finally {
    await connection?.close();
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ inviteToken: string; rsvpToken: string }> },
) {
  const { inviteToken, rsvpToken } = await params;
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
      ["public-events", "guest-rsvp", inviteToken, rsvpToken],
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
    const result = await updatePublicGuestRsvp(
      connection.db,
      inviteToken,
      rsvpToken,
      payload,
    );

    if (!result) {
      return Response.json({ error: "Guest RSVP not found" }, { status: 404 });
    }

    void trackAnalyticsEvent("guest_rsvp_updated");

    return Response.json(result);
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

    logServerError("public_guest_rsvp_update_failed", error, {
      component: "public-events",
    });

    return Response.json(
      { error: "Guest RSVP is unavailable" },
      { status: 503 },
    );
  } finally {
    await connection?.close();
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ inviteToken: string; rsvpToken: string }> },
) {
  const { inviteToken, rsvpToken } = await params;
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
      ["public-events", "guest-rsvp", inviteToken, rsvpToken],
    );
  } catch (error) {
    return rateLimitResponse(
      error,
      "Too many guest RSVP attempts. Try again later.",
    );
  }

  try {
    connection = createDatabaseConnection();
    const result = await cancelPublicGuestRsvp(
      connection.db,
      inviteToken,
      rsvpToken,
    );

    if (!result) {
      return Response.json({ error: "Guest RSVP not found" }, { status: 404 });
    }

    void trackAnalyticsEvent("guest_rsvp_cancelled");

    return Response.json(result);
  } catch (error) {
    logServerError("public_guest_rsvp_cancellation_failed", error, {
      component: "public-events",
    });

    return Response.json(
      { error: "Guest RSVP is unavailable" },
      { status: 503 },
    );
  } finally {
    await connection?.close();
  }
}

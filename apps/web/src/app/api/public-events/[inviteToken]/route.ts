import { createDatabaseConnection } from "@/db/client";
import { getPublicEventInviteView } from "@/features/events/public-event";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ inviteToken: string }> },
) {
  const { inviteToken } = await params;
  let connection;

  try {
    connection = createDatabaseConnection();
    const event = await getPublicEventInviteView(connection.db, inviteToken);

    if (!event) {
      return Response.json(
        { error: "Event invite not found" },
        { status: 404 },
      );
    }

    return Response.json({ event });
  } catch {
    console.error("Public event invite lookup failed");

    return Response.json(
      { error: "Event invite lookup is unavailable" },
      { status: 503 },
    );
  } finally {
    await connection?.close();
  }
}

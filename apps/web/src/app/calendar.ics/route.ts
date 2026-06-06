import { createDatabaseConnection } from "@/db/client";
import { listCalendarEventsForViewer } from "@/db/queries/event-planning";
import { getLoginRedirectPath, getServerSession } from "@/features/auth/server";
import { renderCalendarExport } from "@/features/events/calendar-export";
import { logServerError } from "@/lib/logger";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const session = await getServerSession();

  if (!session) {
    return Response.redirect(
      new URL(getLoginRedirectPath("/calendar.ics"), request.url),
      303,
    );
  }

  let connection;

  try {
    connection = createDatabaseConnection();

    const events = await listCalendarEventsForViewer(connection.db, {
      viewerUserId: session.user.id,
    });
    const calendar = renderCalendarExport(events);

    return new Response(calendar, {
      headers: {
        "content-disposition": 'inline; filename="pod-tracker.ics"',
        "content-type": "text/calendar; charset=utf-8",
      },
    });
  } catch (error) {
    logServerError("calendar_export_failed", error, { component: "calendar" });

    return new Response("Calendar export is unavailable.", {
      status: 503,
      headers: {
        "content-type": "text/plain; charset=utf-8",
      },
    });
  } finally {
    await connection?.close();
  }
}

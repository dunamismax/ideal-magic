import { checkDatabaseReadiness } from "@/lib/health";

export const dynamic = "force-dynamic";

export async function GET() {
  const database = await checkDatabaseReadiness();
  const ok = database.ok;

  return Response.json(
    {
      ok,
      service: "pod-tracker-web",
      checks: {
        next: "ready",
        database: database.status,
      },
    },
    {
      status: ok ? 200 : 503,
    },
  );
}

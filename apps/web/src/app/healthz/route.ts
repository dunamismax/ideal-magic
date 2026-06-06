import { getDatabaseConfigurationCheck } from "@/lib/health";

export const dynamic = "force-dynamic";

export async function GET() {
  const database = getDatabaseConfigurationCheck();

  return Response.json({
    ok: true,
    service: "pod-tracker-web",
    checks: {
      process: "ok",
      database: database.status,
    },
  });
}

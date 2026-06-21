import { handle } from "@/lib/api";
import { sendDiscordReport, ApiError } from "@/lib/quests";

export const dynamic = "force-dynamic";

// POST /api/discord — send a report to the configured webhook.
// Body: { includeWeekly?: boolean }. Also used by a scheduler/cron.
export async function POST(req: Request) {
  return handle(async () => {
    const body = await req.json().catch(() => ({}));
    const includeWeekly = body.includeWeekly !== false;
    const result = await sendDiscordReport(includeWeekly);
    if (!result.ok) throw new ApiError(400, result.error ?? "Failed to send");
    return { ok: true };
  });
}

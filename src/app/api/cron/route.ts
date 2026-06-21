import { handle } from "@/lib/api";
import {
  ApiError,
  resetScope,
  sendDiscordReport,
} from "@/lib/quests";

export const dynamic = "force-dynamic";

/**
 * POST /api/cron — automation hook for schedulers (cron, Task Scheduler, etc.),
 * reproducing the original device's Discord behaviour.
 *
 * Body: { task: "hourly" | "eod" }
 *   - "hourly": post the current quest report to Discord.
 *   - "eod":    post a full report, reset daily quests, and on Sunday also
 *               post a weekly report and reset weekly quests.
 *
 * If CRON_SECRET is set, requests must send `Authorization: Bearer <secret>`.
 */
export async function POST(req: Request) {
  return handle(async () => {
    const secret = process.env.CRON_SECRET;
    if (secret) {
      const auth = req.headers.get("authorization");
      if (auth !== `Bearer ${secret}`)
        throw new ApiError(401, "Unauthorized");
    }

    const body = await req.json().catch(() => ({}));
    const task = body.task;

    if (task === "hourly") {
      const r = await sendDiscordReport(true);
      return { task, sent: r.ok, error: r.error };
    }

    if (task === "eod") {
      const isSunday = new Date().getDay() === 0;
      const daily = await sendDiscordReport(false);
      await resetScope("DAILY");
      let weekly: { ok: boolean; error?: string } | null = null;
      if (isSunday) {
        weekly = await sendDiscordReport(true);
        await resetScope("WEEKLY");
      }
      return {
        task,
        isSunday,
        dailySent: daily.ok,
        weeklySent: weekly?.ok ?? false,
      };
    }

    throw new ApiError(400, 'task must be "hourly" or "eod"');
  });
}

import { handle } from "@/lib/api";
import { addQuest } from "@/lib/quests";
import { ApiError } from "@/lib/quests";
import type { QuestType } from "@/lib/types";

export const dynamic = "force-dynamic";

// POST /api/quests — add a quest. Body: { name, type, durationMin }
export async function POST(req: Request) {
  return handle(async () => {
    const body = await req.json().catch(() => ({}));
    const name = typeof body.name === "string" ? body.name : "";
    const type: QuestType = body.type === "WEEKLY" ? "WEEKLY" : "DAILY";
    const durationMin = Number(body.durationMin ?? 0);
    if (!name.trim()) throw new ApiError(400, "Quest name is required");
    return addQuest({ name, type, durationMin });
  });
}

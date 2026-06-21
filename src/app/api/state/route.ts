import { handle } from "@/lib/api";
import { getState } from "@/lib/quests";

export const dynamic = "force-dynamic";

// GET /api/state — full application state (quests + settings).
export async function GET() {
  return handle(() => getState());
}

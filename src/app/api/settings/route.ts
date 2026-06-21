import { handle } from "@/lib/api";
import { getSettings, updateSettings } from "@/lib/quests";
import type { SettingsDTO } from "@/lib/types";

export const dynamic = "force-dynamic";

// GET /api/settings
export async function GET() {
  return handle(() => getSettings());
}

// PATCH /api/settings — body: Partial<SettingsDTO>
export async function PATCH(req: Request) {
  return handle(async () => {
    const body = (await req.json().catch(() => ({}))) as Partial<SettingsDTO>;
    return updateSettings(body);
  });
}

import { handle } from "@/lib/api";
import { applyAction, deleteQuest, ApiError } from "@/lib/quests";
import type { QuestAction } from "@/lib/types";

export const dynamic = "force-dynamic";

const VALID_ACTIONS: QuestAction[] = [
  "start",
  "complete",
  "abandon",
  "reopen",
  "promote",
  "demote",
];

// PATCH /api/quests/:id — apply an action. Body: { action }
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return handle(async () => {
    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const action = body.action as QuestAction;
    if (!VALID_ACTIONS.includes(action))
      throw new ApiError(400, `Unknown action: ${action}`);
    return applyAction(id, action);
  });
}

// DELETE /api/quests/:id
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return handle(async () => {
    const { id } = await params;
    return deleteQuest(id);
  });
}

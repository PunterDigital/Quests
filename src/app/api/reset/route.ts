import { handle } from "@/lib/api";
import { resetScope, ApiError } from "@/lib/quests";

export const dynamic = "force-dynamic";

// POST /api/reset — reset a scope. Body: { scope: "DAILY" | "WEEKLY" }
export async function POST(req: Request) {
  return handle(async () => {
    const body = await req.json().catch(() => ({}));
    const scope = body.scope;
    if (scope !== "DAILY" && scope !== "WEEKLY")
      throw new ApiError(400, "scope must be DAILY or WEEKLY");
    return resetScope(scope);
  });
}

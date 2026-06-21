import { NextResponse } from "next/server";
import { ApiError } from "@/lib/quests";

// Wrap a handler so domain ApiErrors map to proper status codes and unexpected
// errors return a 500 without leaking internals.
export async function handle<T>(fn: () => Promise<T>): Promise<NextResponse> {
  try {
    return NextResponse.json(await fn());
  } catch (e) {
    if (e instanceof ApiError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    console.error("[api]", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

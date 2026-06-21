"use client";

import useSWR from "swr";
import type {
  AppState,
  QuestAction,
  QuestType,
  SettingsDTO,
} from "@/lib/types";

async function fetcher(url: string): Promise<AppState> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Request failed: ${res.status}`);
  return res.json();
}

// Polls /api/state so multiple devices stay in sync.
export function useAppState() {
  return useSWR<AppState>("/api/state", fetcher, {
    refreshInterval: 4000,
    revalidateOnFocus: true,
    keepPreviousData: true,
  });
}

async function mutateRequest(
  url: string,
  method: string,
  body?: unknown,
): Promise<AppState> {
  const res = await fetch(url, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? `Request failed: ${res.status}`);
  return data as AppState;
}

export const api = {
  addQuest: (name: string, type: QuestType, durationMin: number) =>
    mutateRequest("/api/quests", "POST", { name, type, durationMin }),

  action: (id: string, action: QuestAction) =>
    mutateRequest(`/api/quests/${id}`, "PATCH", { action }),

  remove: (id: string) => mutateRequest(`/api/quests/${id}`, "DELETE"),

  reset: (scope: QuestType) => mutateRequest("/api/reset", "POST", { scope }),

  updateSettings: (patch: Partial<SettingsDTO>) =>
    mutateRequest("/api/settings", "PATCH", patch) as Promise<unknown>,

  sendDiscord: async (includeWeekly = true) => {
    const res = await fetch("/api/discord", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ includeWeekly }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error ?? "Failed to send report");
    return data;
  },
};

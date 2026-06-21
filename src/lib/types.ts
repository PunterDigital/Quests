// Shared types between server and client.

export type QuestType = "DAILY" | "WEEKLY";
export type QuestStatus = "TODO" | "ACTIVE" | "DONE" | "ABANDONED";

// Quest as serialized over JSON (dates become ISO strings).
export interface QuestDTO {
  id: string;
  name: string;
  type: QuestType;
  status: QuestStatus;
  inPool: boolean;
  durationMin: number;
  startedAt: string | null;
  awardedXp: number | null;
  sort: number;
  createdAt: string;
  updatedAt: string;
}

export interface SettingsDTO {
  discordWebhook: string | null;
  dailyLimit: number;
  weeklyLimit: number;
}

// Player profile + derived level info.
export interface ProfileDTO {
  totalXp: number;
  level: number;
  xpIntoLevel: number;
  xpForNextLevel: number;
  progress: number;
}

export interface AppState {
  quests: QuestDTO[];
  settings: SettingsDTO;
  profile: ProfileDTO;
}

// Per-quest actions the API understands.
export type QuestAction =
  | "start" // TODO -> ACTIVE
  | "complete" // -> DONE
  | "abandon" // -> ABANDONED
  | "reopen" // -> TODO (clears timer)
  | "promote" // move out of the pool into the active set
  | "demote"; // move into the pool

// Display ordering: active first, then todo, abandoned, done last.
export function statusSortOrder(status: QuestStatus): number {
  switch (status) {
    case "ACTIVE":
      return 0;
    case "TODO":
      return 1;
    case "ABANDONED":
      return 2;
    case "DONE":
      return 3;
  }
}

// Minutes/seconds left on an active timed quest. Returns null when there is no
// time limit; negative values mean overdue.
export function remainingSeconds(quest: QuestDTO, now = Date.now()): number | null {
  if (quest.durationMin <= 0 || !quest.startedAt) return null;
  const end = new Date(quest.startedAt).getTime() + quest.durationMin * 60_000;
  return Math.round((end - now) / 1000);
}

export function formatRemaining(secs: number | null): string {
  if (secs === null) return "No limit";
  if (secs <= 0) return "OVERDUE";
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

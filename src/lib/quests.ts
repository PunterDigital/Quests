import { prisma } from "@/lib/prisma";
import type { Quest } from "@prisma/client";
import {
  AppState,
  ProfileDTO,
  QuestAction,
  QuestDTO,
  QuestType,
  SettingsDTO,
  statusSortOrder,
} from "@/lib/types";
import { levelInfoFromXp, rollXp } from "@/lib/xp";

const SETTINGS_ID = "singleton";

// ---------------------------------------------------------------------------
// Serialization
// ---------------------------------------------------------------------------
function toDTO(q: Quest): QuestDTO {
  return {
    id: q.id,
    name: q.name,
    type: q.type as QuestType,
    status: q.status as QuestDTO["status"],
    inPool: q.inPool,
    durationMin: q.durationMin,
    startedAt: q.startedAt ? q.startedAt.toISOString() : null,
    awardedXp: q.awardedXp,
    sort: q.sort,
    createdAt: q.createdAt.toISOString(),
    updatedAt: q.updatedAt.toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Settings (single row, created lazily)
// ---------------------------------------------------------------------------
export async function getSettings(): Promise<SettingsDTO> {
  const s = await prisma.settings.upsert({
    where: { id: SETTINGS_ID },
    update: {},
    create: { id: SETTINGS_ID },
  });
  return {
    discordWebhook: s.discordWebhook,
    dailyLimit: s.dailyLimit,
    weeklyLimit: s.weeklyLimit,
  };
}

export async function updateSettings(
  patch: Partial<SettingsDTO>,
): Promise<SettingsDTO> {
  await getSettings(); // ensure row exists
  const data: Record<string, unknown> = {};
  if (patch.discordWebhook !== undefined)
    data.discordWebhook = patch.discordWebhook?.trim() || null;
  if (patch.dailyLimit !== undefined)
    data.dailyLimit = clampInt(patch.dailyLimit, 1, 50);
  if (patch.weeklyLimit !== undefined)
    data.weeklyLimit = clampInt(patch.weeklyLimit, 1, 50);
  const s = await prisma.settings.update({
    where: { id: SETTINGS_ID },
    data,
  });
  return {
    discordWebhook: s.discordWebhook,
    dailyLimit: s.dailyLimit,
    weeklyLimit: s.weeklyLimit,
  };
}

// ---------------------------------------------------------------------------
// Profile / XP (single row, created lazily)
// ---------------------------------------------------------------------------
export async function getProfile(): Promise<ProfileDTO> {
  const p = await prisma.profile.upsert({
    where: { id: SETTINGS_ID },
    update: {},
    create: { id: SETTINGS_ID },
  });
  return { totalXp: p.totalXp, ...levelInfoFromXp(p.totalXp) };
}

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------
export async function getState(): Promise<AppState> {
  const [quests, settings, profile] = await Promise.all([
    prisma.quest.findMany({ orderBy: [{ sort: "asc" }, { createdAt: "asc" }] }),
    getSettings(),
    getProfile(),
  ]);
  return { quests: quests.map(toDTO), settings, profile };
}

function activeLimit(type: QuestType, settings: SettingsDTO): number {
  return type === "WEEKLY" ? settings.weeklyLimit : settings.dailyLimit;
}

// Count quests of a type that occupy an active slot (i.e. not in the pool).
async function countActiveSlots(type: QuestType): Promise<number> {
  return prisma.quest.count({ where: { type, inPool: false } });
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------
export async function addQuest(input: {
  name: string;
  type: QuestType;
  durationMin: number;
}): Promise<AppState> {
  const name = input.name.trim().slice(0, 60);
  if (!name) throw new ApiError(400, "Quest name is required");

  const maxSort = await prisma.quest.aggregate({ _max: { sort: true } });

  // New quests are queued in the pool; they only become active when drawn on the
  // next daily/weekly run (reset) or promoted manually.
  await prisma.quest.create({
    data: {
      name,
      type: input.type,
      status: "TODO",
      durationMin: clampInt(input.durationMin, 0, 1440),
      inPool: true,
      sort: (maxSort._max.sort ?? 0) + 1,
    },
  });
  return getState();
}

export async function deleteQuest(id: string): Promise<AppState> {
  await prisma.quest.delete({ where: { id } }).catch(() => {
    throw new ApiError(404, "Quest not found");
  });
  return getState();
}

export async function applyAction(
  id: string,
  action: QuestAction,
): Promise<AppState> {
  const quest = await prisma.quest.findUnique({ where: { id } });
  if (!quest) throw new ApiError(404, "Quest not found");

  switch (action) {
    case "start":
      await prisma.quest.update({
        where: { id },
        data: { status: "ACTIVE", startedAt: new Date() },
      });
      break;
    case "complete": {
      // Award XP once per completion; re-completing an already-rewarded quest
      // (e.g. it was DONE) does not grant more.
      if (quest.awardedXp == null) {
        const gain = rollXp(quest.type as QuestType);
        await prisma.profile.upsert({
          where: { id: SETTINGS_ID },
          update: { totalXp: { increment: gain } },
          create: { id: SETTINGS_ID, totalXp: gain },
        });
        await prisma.quest.update({
          where: { id },
          data: { status: "DONE", awardedXp: gain },
        });
      } else {
        await prisma.quest.update({ where: { id }, data: { status: "DONE" } });
      }
      break;
    }
    case "abandon":
      await prisma.quest.update({
        where: { id },
        data: { status: "ABANDONED" },
      });
      break;
    case "reopen": {
      // Refund the XP this quest granted, so reopening is a clean undo.
      if (quest.awardedXp != null) {
        await prisma.profile.upsert({
          where: { id: SETTINGS_ID },
          update: { totalXp: { decrement: quest.awardedXp } },
          create: { id: SETTINGS_ID, totalXp: 0 },
        });
        await prisma.profile.updateMany({
          where: { id: SETTINGS_ID, totalXp: { lt: 0 } },
          data: { totalXp: 0 },
        });
      }
      await prisma.quest.update({
        where: { id },
        data: { status: "TODO", startedAt: null, awardedXp: null },
      });
      break;
    }
    case "promote": {
      if (!quest.inPool) break;
      const limit = activeLimit(
        quest.type as QuestType,
        await getSettings(),
      );
      const activeCount = await countActiveSlots(quest.type as QuestType);
      if (activeCount >= limit)
        throw new ApiError(
          409,
          `Active ${quest.type.toLowerCase()} limit reached (${limit})`,
        );
      await prisma.quest.update({ where: { id }, data: { inPool: false } });
      break;
    }
    case "demote":
      await prisma.quest.update({
        where: { id },
        data: { inPool: true, status: "TODO", startedAt: null },
      });
      break;
  }
  return getState();
}

// Reset a scope: everything of that type goes back to TODO, then a RANDOM draw
// of `limit` quests fills the active slots and the rest spill to the pool.
// This is the "random quest of the day" mechanic — each reset reshuffles which
// quests from the pool become active.
export async function resetScope(scope: QuestType): Promise<AppState> {
  const settings = await getSettings();
  const limit = activeLimit(scope, settings);
  const quests = await prisma.quest.findMany({ where: { type: scope } });

  const drawn = shuffle(quests.map((q) => q.id));
  const activeIds = new Set(drawn.slice(0, limit));

  await prisma.$transaction(
    quests.map((q) =>
      prisma.quest.update({
        where: { id: q.id },
        data: {
          status: "TODO",
          startedAt: null,
          awardedXp: null, // earned XP is kept; quest can pay out again
          inPool: !activeIds.has(q.id),
        },
      }),
    ),
  );
  return getState();
}

// ---------------------------------------------------------------------------
// Discord report
// ---------------------------------------------------------------------------
export async function buildReport(includeWeekly = true): Promise<string> {
  const quests = (
    await prisma.quest.findMany({
      where: { inPool: false },
      orderBy: [{ sort: "asc" }, { createdAt: "asc" }],
    })
  ).map(toDTO);

  const daily = quests
    .filter((q) => q.type === "DAILY")
    .sort(sortForDisplay);
  const weekly = quests
    .filter((q) => q.type === "WEEKLY")
    .sort(sortForDisplay);

  const tag = (s: QuestDTO["status"]) =>
    s === "DONE"
      ? "[done]"
      : s === "ACTIVE"
        ? "[active]"
        : s === "ABANDONED"
          ? "[skip]"
          : "[todo]";

  let msg = "**Quest Report**\n**Daily:**\n";
  for (const q of daily) msg += `${tag(q.status)} ${q.name}\n`;
  if (includeWeekly) {
    msg += "**Weekly:**\n";
    for (const q of weekly) msg += `${tag(q.status)} ${q.name}\n`;
  }

  const dDone = daily.filter((q) => q.status === "DONE").length;
  const wDone = weekly.filter((q) => q.status === "DONE").length;
  msg += includeWeekly
    ? `Snapshot: Daily ${dDone}/${daily.length} | Weekly ${wDone}/${weekly.length}`
    : `Snapshot: Daily ${dDone}/${daily.length}`;
  return msg;
}

export async function sendDiscordReport(
  includeWeekly = true,
): Promise<{ ok: boolean; error?: string }> {
  const settings = await getSettings();
  if (!settings.discordWebhook)
    return { ok: false, error: "No Discord webhook configured" };
  const content = await buildReport(includeWeekly);
  try {
    const res = await fetch(settings.discordWebhook, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content }),
    });
    if (!res.ok)
      return { ok: false, error: `Discord responded ${res.status}` };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function sortForDisplay(a: QuestDTO, b: QuestDTO): number {
  const s = statusSortOrder(a.status) - statusSortOrder(b.status);
  return s !== 0 ? s : a.sort - b.sort;
}

// Fisher-Yates shuffle (returns a new array).
function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function clampInt(n: number, min: number, max: number): number {
  if (Number.isNaN(n)) return min;
  return Math.max(min, Math.min(max, Math.round(n)));
}

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

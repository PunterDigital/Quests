// Experience & leveling math. Pure functions shared by server and client.
import type { QuestType } from "@/lib/types";

// XP awarded for completing a quest, rolled randomly within these ranges.
export const XP_RANGES: Record<QuestType, { min: number; max: number }> = {
  DAILY: { min: 10, max: 25 },
  WEEKLY: { min: 50, max: 120 },
};

// Exponential level curve. Cost to go from `level` -> `level + 1`:
//   100, 150, 225, 338, 506, ...  (×1.5 each level)
export const LEVEL_BASE = 100;
export const LEVEL_GROWTH = 1.5;

export function xpForLevelUp(level: number): number {
  return Math.round(LEVEL_BASE * Math.pow(LEVEL_GROWTH, Math.max(0, level - 1)));
}

export interface LevelInfo {
  level: number; // current level (starts at 1)
  xpIntoLevel: number; // XP accumulated within the current level
  xpForNextLevel: number; // XP needed to clear the current level
  progress: number; // 0..1 toward the next level
}

// Derive level + progress from a cumulative XP total.
export function levelInfoFromXp(totalXp: number): LevelInfo {
  let level = 1;
  let remaining = Math.max(0, Math.floor(totalXp));
  let need = xpForLevelUp(level);
  while (remaining >= need && level < 9999) {
    remaining -= need;
    level++;
    need = xpForLevelUp(level);
  }
  return {
    level,
    xpIntoLevel: remaining,
    xpForNextLevel: need,
    progress: need > 0 ? remaining / need : 0,
  };
}

// Roll a random XP award for completing a quest of the given type.
export function rollXp(type: QuestType): number {
  const { min, max } = XP_RANGES[type];
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

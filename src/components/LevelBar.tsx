import type { ProfileDTO } from "@/lib/types";

export function LevelBar({ profile }: { profile: ProfileDTO }) {
  const pct = Math.round(profile.progress * 100);
  return (
    <section className="flex items-center gap-3 rounded-xl border border-[var(--border)] bg-gradient-to-br from-[var(--surface)] to-[color-mix(in_srgb,var(--purple)_10%,var(--surface))] p-4">
      {/* Level badge */}
      <div className="flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-full border-2 border-[var(--purple)] bg-[var(--surface-2)]">
        <span className="text-[9px] font-semibold uppercase leading-none text-[var(--muted)]">
          Lvl
        </span>
        <span className="text-xl font-bold leading-none text-[var(--purple)]">
          {profile.level}
        </span>
      </div>

      <div className="flex flex-1 flex-col gap-1.5">
        <div className="flex items-baseline justify-between">
          <span className="text-sm font-semibold">Level {profile.level}</span>
          <span className="font-mono text-xs text-[var(--muted)]">
            {profile.totalXp.toLocaleString()} XP total
          </span>
        </div>
        <div className="h-3 overflow-hidden rounded-full bg-[var(--surface-2)] ring-1 ring-[var(--border)]">
          <div
            className="h-full rounded-full bg-gradient-to-r from-[var(--purple)] to-[var(--cyan)] transition-[width] duration-500 ease-out"
            style={{ width: `${pct}%` }}
          />
        </div>
        <span className="font-mono text-[11px] text-[var(--muted)]">
          {profile.xpIntoLevel} / {profile.xpForNextLevel} XP to level{" "}
          {profile.level + 1}
        </span>
      </div>
    </section>
  );
}

"use client";

import { useMemo, useState } from "react";
import { api, useAppState } from "@/lib/client";
import {
  statusSortOrder,
  type AppState,
  type QuestAction,
  type QuestDTO,
  type QuestType,
} from "@/lib/types";
import { ProgressBar } from "@/components/ProgressBar";
import { QuestCard } from "@/components/QuestCard";
import { AddQuestForm } from "@/components/AddQuestForm";
import { SettingsPanel } from "@/components/SettingsPanel";
import { LevelBar } from "@/components/LevelBar";

function displaySort(a: QuestDTO, b: QuestDTO) {
  const s = statusSortOrder(a.status) - statusSortOrder(b.status);
  return s !== 0 ? s : a.sort - b.sort;
}

interface Group {
  type: QuestType;
  active: QuestDTO[];
  pool: QuestDTO[];
  done: number;
  total: number;
  limit: number;
}

type Tab = "quests" | "pool" | "settings";

export default function Home() {
  const { data, error, isLoading, isValidating, mutate } = useAppState();
  const [tab, setTab] = useState<Tab>("quests");
  const [toast, setToast] = useState<{ msg: string; kind: "xp" | "level" } | null>(
    null,
  );

  function showToast(msg: string, kind: "xp" | "level") {
    setToast({ msg, kind });
    setTimeout(() => setToast(null), kind === "level" ? 4000 : 2200);
  }

  const groups = useMemo(() => {
    const quests = data?.quests ?? [];
    const build = (type: QuestType, limit: number): Group => {
      const all = quests.filter((q) => q.type === type);
      const active = all.filter((q) => !q.inPool).sort(displaySort);
      const pool = all.filter((q) => q.inPool).sort((a, b) => a.sort - b.sort);
      return {
        type,
        active,
        pool,
        done: active.filter((q) => q.status === "DONE").length,
        total: active.length,
        limit,
      };
    };
    return {
      daily: build("DAILY", data?.settings.dailyLimit ?? 5),
      weekly: build("WEEKLY", data?.settings.weeklyLimit ?? 15),
    };
  }, [data]);

  const overallDone = groups.daily.done + groups.weekly.done;
  const overallTotal = groups.daily.total + groups.weekly.total;
  const poolCount = groups.daily.pool.length + groups.weekly.pool.length;

  // Apply a mutation that returns fresh state, updating the cache immediately.
  const withState = async (p: Promise<AppState>) => {
    const next = await p;
    await mutate(next, { revalidate: false });
    return next;
  };

  const onAdd = (name: string, type: QuestType, dur: number) =>
    withState(api.addQuest(name, type, dur)).then(() => {});

  // Detect XP gains / level-ups from a completion and celebrate them.
  const onAction = async (id: string, action: QuestAction) => {
    const beforeLevel = data?.profile.level ?? 1;
    const beforeXp = data?.profile.totalXp ?? 0;
    const next = await withState(api.action(id, action));
    if (next.profile.level > beforeLevel) {
      showToast(`⭐ Level up! You reached level ${next.profile.level}`, "level");
    } else if (next.profile.totalXp > beforeXp) {
      showToast(`+${next.profile.totalXp - beforeXp} XP`, "xp");
    }
  };

  const onDelete = (id: string) => withState(api.remove(id)).then(() => {});
  const onDraw = (scope: QuestType) =>
    withState(api.reset(scope)).then(() => {});

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-4 px-4 pb-16 pt-5">
      {/* Header */}
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[var(--purple)]">
            Quest Tracker
          </h1>
          <p className="flex items-center gap-1.5 text-xs text-[var(--muted)]">
            <span
              className={`inline-block h-1.5 w-1.5 rounded-full ${
                error
                  ? "bg-[var(--red)]"
                  : isValidating
                    ? "animate-pulse bg-[var(--cyan)]"
                    : "bg-[var(--green)]"
              }`}
            />
            {error ? "Offline" : isValidating ? "Syncing…" : "Synced"}
          </p>
        </div>
        <nav className="flex gap-1 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-1">
          <TabBtn active={tab === "quests"} onClick={() => setTab("quests")}>
            Quests
          </TabBtn>
          <TabBtn active={tab === "pool"} onClick={() => setTab("pool")}>
            Pool
            {poolCount > 0 && (
              <span className="ml-1 rounded-full bg-[var(--purple)] px-1.5 text-[10px] font-bold text-[#0c0c14]">
                {poolCount}
              </span>
            )}
          </TabBtn>
          <TabBtn active={tab === "settings"} onClick={() => setTab("settings")}>
            ⚙
          </TabBtn>
        </nav>
      </header>

      {data && <LevelBar profile={data.profile} />}

      {isLoading && !data && (
        <p className="py-10 text-center text-sm text-[var(--muted)]">Loading…</p>
      )}

      {error && !data && (
        <p className="py-10 text-center text-sm text-[var(--red)]">
          Could not reach the server. Is the dev server / database running?
        </p>
      )}

      {data && tab === "settings" && (
        <SettingsPanel
          key={`${data.settings.discordWebhook}|${data.settings.dailyLimit}|${data.settings.weeklyLimit}`}
          settings={data.settings}
          onChanged={() => mutate()}
        />
      )}

      {/* Active board — the current run */}
      {data && tab === "quests" && (
        <>
          <section className="flex flex-col gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold">Overall progress</span>
              <span className="font-mono text-xs text-[var(--muted)]">
                {overallTotal > 0
                  ? `${Math.round((overallDone / overallTotal) * 100)}%`
                  : "—"}
              </span>
            </div>
            <ProgressBar
              done={overallDone}
              total={overallTotal}
              color="var(--purple)"
            />
          </section>

          <ScopeSection
            title="Daily"
            color="var(--green)"
            group={groups.daily}
            onAction={onAction}
            onDelete={onDelete}
            onDraw={onDraw}
            onGoToPool={() => setTab("pool")}
          />
          <ScopeSection
            title="Weekly"
            color="var(--orange)"
            group={groups.weekly}
            onAction={onAction}
            onDelete={onDelete}
            onDraw={onDraw}
            onGoToPool={() => setTab("pool")}
          />
        </>
      )}

      {/* Pool — the full backlog of quests */}
      {data && tab === "pool" && (
        <>
          <AddQuestForm onAdd={onAdd} />
          <p className="px-1 text-xs text-[var(--muted)]">
            New quests are queued here. Each daily/weekly run draws from the pool —
            or tap <strong>Activate</strong> to add one to the current run now.
          </p>
          <PoolSection
            title="Daily"
            color="var(--green)"
            group={groups.daily}
            onAction={onAction}
            onDelete={onDelete}
          />
          <PoolSection
            title="Weekly"
            color="var(--orange)"
            group={groups.weekly}
            onAction={onAction}
            onDelete={onDelete}
          />
        </>
      )}

      {/* XP / level-up toast */}
      {toast && (
        <div
          className={`pointer-events-none fixed inset-x-0 bottom-6 z-50 mx-auto w-fit rounded-full px-5 py-2.5 text-sm font-bold shadow-lg ${
            toast.kind === "level"
              ? "animate-bounce bg-[var(--purple)] text-[#0c0c14]"
              : "bg-[var(--green)] text-[#0c0c14]"
          }`}
        >
          {toast.msg}
        </div>
      )}
    </main>
  );
}

// Active board section: shows the current run for a scope + a "Draw" action.
function ScopeSection({
  title,
  color,
  group,
  onAction,
  onDelete,
  onDraw,
  onGoToPool,
}: {
  title: string;
  color: string;
  group: Group;
  onAction: (id: string, action: QuestAction) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onDraw: (scope: QuestType) => Promise<void>;
  onGoToPool: () => void;
}) {
  const canPromote = group.active.length < group.limit;
  const draw = () => {
    if (
      group.active.some((q) => q.status === "DONE" || q.status === "ACTIVE") &&
      !confirm(
        `Start a new ${title.toLowerCase()} run? This resets progress and draws a fresh set from the pool.`,
      )
    )
      return;
    onDraw(group.type);
  };

  return (
    <section className="flex flex-col gap-2">
      <div className="flex items-center justify-between px-1">
        <h2
          className="text-sm font-bold uppercase tracking-wide"
          style={{ color }}
        >
          {title}
        </h2>
        <div className="flex items-center gap-2">
          <span className="text-xs text-[var(--muted)]">
            {group.active.length}/{group.limit} active
          </span>
          {group.pool.length > 0 && (
            <button
              onClick={draw}
              title="Reset progress and draw a fresh set from the pool"
              className="rounded-md bg-[color-mix(in_srgb,var(--purple)_16%,transparent)] px-2 py-1 text-xs font-medium text-[var(--purple)]"
            >
              🎲 Draw
            </button>
          )}
        </div>
      </div>
      <ProgressBar done={group.done} total={group.total} color={color} />

      {group.active.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[var(--border)] px-3 py-6 text-center text-xs text-[var(--muted)]">
          {group.pool.length > 0 ? (
            <>
              No active {title.toLowerCase()} quests. Tap{" "}
              <strong>🎲 Draw</strong> to pick {group.limit} from the pool.
            </>
          ) : (
            <>
              No {title.toLowerCase()} quests yet.{" "}
              <button
                onClick={onGoToPool}
                className="font-semibold text-[var(--purple)] underline"
              >
                Add some in the Pool
              </button>
              .
            </>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {group.active.map((q) => (
            <QuestCard
              key={q.id}
              quest={q}
              canPromote={canPromote}
              onAction={onAction}
              onDelete={onDelete}
            />
          ))}
        </div>
      )}
    </section>
  );
}

// Pool section: the full backlog of quests for a scope (active + queued).
function PoolSection({
  title,
  color,
  group,
  onAction,
  onDelete,
}: {
  title: string;
  color: string;
  group: Group;
  onAction: (id: string, action: QuestAction) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) {
  const canPromote = group.active.length < group.limit;
  const all = [...group.active, ...group.pool];
  return (
    <section className="flex flex-col gap-2">
      <div className="flex items-center justify-between px-1">
        <h2
          className="text-sm font-bold uppercase tracking-wide"
          style={{ color }}
        >
          {title}
        </h2>
        <span className="text-xs text-[var(--muted)]">
          {group.pool.length} queued · {group.active.length}/{group.limit} active
        </span>
      </div>

      {all.length === 0 ? (
        <p className="rounded-xl border border-dashed border-[var(--border)] px-3 py-6 text-center text-xs text-[var(--muted)]">
          No {title.toLowerCase()} quests yet. Add one above.
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {all.map((q) => (
            <QuestCard
              key={q.id}
              quest={q}
              canPromote={canPromote}
              onAction={onAction}
              onDelete={onDelete}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function TabBtn({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
        active
          ? "bg-[var(--purple)] text-[#0c0c14]"
          : "text-[var(--muted)] hover:text-[var(--foreground)]"
      }`}
    >
      {children}
    </button>
  );
}

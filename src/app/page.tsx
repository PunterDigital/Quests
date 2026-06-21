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
  active: QuestDTO[];
  pool: QuestDTO[];
  done: number;
  total: number;
  limit: number;
}

export default function Home() {
  const { data, error, isLoading, isValidating, mutate } = useAppState();
  const [tab, setTab] = useState<"quests" | "settings">("quests");
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

      {data && tab === "quests" && (
        <>
          {/* Overall progress */}
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

          <AddQuestForm onAdd={onAdd} />

          <ScopeSection
            title="Daily"
            color="var(--green)"
            group={groups.daily}
            onAction={onAction}
            onDelete={onDelete}
          />
          <ScopeSection
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

function ScopeSection({
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
          {group.active.length}/{group.limit} active
        </span>
      </div>
      <ProgressBar done={group.done} total={group.total} color={color} />

      {group.active.length === 0 && group.pool.length === 0 ? (
        <p className="rounded-xl border border-dashed border-[var(--border)] px-3 py-6 text-center text-xs text-[var(--muted)]">
          No {title.toLowerCase()} quests yet. Add one above.
        </p>
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

      {group.pool.length > 0 && (
        <details className="group mt-1">
          <summary className="cursor-pointer select-none px-1 text-xs text-[var(--muted)]">
            Pool ({group.pool.length}) — extra quests beyond the active limit
          </summary>
          <div className="mt-2 flex flex-col gap-2">
            {group.pool.map((q) => (
              <QuestCard
                key={q.id}
                quest={q}
                canPromote={canPromote}
                onAction={onAction}
                onDelete={onDelete}
              />
            ))}
          </div>
        </details>
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
      className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
        active
          ? "bg-[var(--purple)] text-[#0c0c14]"
          : "text-[var(--muted)] hover:text-[var(--foreground)]"
      }`}
    >
      {children}
    </button>
  );
}

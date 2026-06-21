"use client";

import { useState } from "react";
import type { QuestAction, QuestDTO, QuestStatus } from "@/lib/types";
import { Countdown } from "@/components/Countdown";

const STATUS_META: Record<
  QuestStatus,
  { label: string; color: string }
> = {
  TODO: { label: "Todo", color: "var(--cyan)" },
  ACTIVE: { label: "Active", color: "var(--orange)" },
  DONE: { label: "Done", color: "var(--green)" },
  ABANDONED: { label: "Skipped", color: "var(--muted)" },
};

interface Props {
  quest: QuestDTO;
  canPromote: boolean;
  onAction: (id: string, action: QuestAction) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

export function QuestCard({ quest, canPromote, onAction, onDelete }: Props) {
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const meta = STATUS_META[quest.status];
  const muted = quest.status === "DONE" || quest.status === "ABANDONED";

  async function run(fn: () => Promise<void>) {
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const accent = quest.inPool ? "var(--border)" : meta.color;

  return (
    <div
      className="flex flex-col gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3"
      style={{ borderLeft: `4px solid ${accent}` }}
    >
      <div className="flex items-start justify-between gap-2">
        <span
          className={`text-sm font-medium leading-snug ${muted ? "text-[var(--muted)] line-through" : "text-[var(--foreground)]"}`}
        >
          {quest.name}
        </span>
        <div className="flex shrink-0 items-center gap-1.5">
          {quest.inPool ? (
            <Tag color="var(--muted)">Pool</Tag>
          ) : (
            <Tag color={meta.color}>{meta.label}</Tag>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[var(--muted)]">
        {quest.durationMin > 0 && <span>⏳ {quest.durationMin}m</span>}
        {quest.status === "ACTIVE" && <Countdown quest={quest} />}
        {quest.status === "DONE" && quest.awardedXp != null && (
          <span className="font-mono font-semibold text-[var(--green)]">
            +{quest.awardedXp} XP
          </span>
        )}
      </div>

      <div className="flex flex-wrap gap-1.5">
        {confirmDelete ? (
          <>
            <span className="self-center text-xs text-[var(--red)]">
              Delete?
            </span>
            <Btn
              color="var(--red)"
              filled
              disabled={busy}
              onClick={() => run(() => onDelete(quest.id))}
            >
              Yes
            </Btn>
            <Btn color="var(--muted)" onClick={() => setConfirmDelete(false)}>
              No
            </Btn>
          </>
        ) : (
          <>
            {quest.inPool ? (
              <Btn
                color="var(--purple)"
                filled
                disabled={busy || !canPromote}
                title={
                  canPromote ? "Move into active set" : "Active set is full"
                }
                onClick={() => run(() => onAction(quest.id, "promote"))}
              >
                Activate
              </Btn>
            ) : (
              <>
                {quest.status === "TODO" && (
                  <Btn
                    color="var(--green)"
                    filled
                    disabled={busy}
                    onClick={() => run(() => onAction(quest.id, "start"))}
                  >
                    ▶ Start
                  </Btn>
                )}
                {quest.status === "ACTIVE" && (
                  <>
                    <Btn
                      color="var(--green)"
                      filled
                      disabled={busy}
                      onClick={() => run(() => onAction(quest.id, "complete"))}
                    >
                      ✓ Complete
                    </Btn>
                    <Btn
                      color="var(--muted)"
                      disabled={busy}
                      onClick={() => run(() => onAction(quest.id, "abandon"))}
                    >
                      Skip
                    </Btn>
                  </>
                )}
                {(quest.status === "DONE" || quest.status === "ABANDONED") && (
                  <Btn
                    color="var(--cyan)"
                    disabled={busy}
                    onClick={() => run(() => onAction(quest.id, "reopen"))}
                  >
                    ↺ Reopen
                  </Btn>
                )}
                {quest.status === "TODO" && (
                  <Btn
                    color="var(--muted)"
                    disabled={busy}
                    title="Move to pool"
                    onClick={() => run(() => onAction(quest.id, "demote"))}
                  >
                    Pool
                  </Btn>
                )}
              </>
            )}
            <button
              className="ml-auto rounded-md px-2 py-1 text-xs text-[var(--muted)] transition-colors hover:text-[var(--red)] disabled:opacity-40"
              disabled={busy}
              onClick={() => setConfirmDelete(true)}
              title="Delete quest"
            >
              🗑
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function Tag({ children, color }: { children: React.ReactNode; color: string }) {
  return (
    <span
      className="rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
      style={{ color, background: `color-mix(in srgb, ${color} 14%, transparent)` }}
    >
      {children}
    </span>
  );
}

function Btn({
  children,
  color,
  filled,
  onClick,
  disabled,
  title,
}: {
  children: React.ReactNode;
  color: string;
  filled?: boolean;
  onClick: () => void;
  disabled?: boolean;
  title?: string;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      className="rounded-md px-2.5 py-1 text-xs font-medium transition-opacity disabled:cursor-not-allowed disabled:opacity-40"
      style={
        filled
          ? { background: color, color: "#0c0c14" }
          : {
              color,
              background: `color-mix(in srgb, ${color} 12%, transparent)`,
            }
      }
    >
      {children}
    </button>
  );
}

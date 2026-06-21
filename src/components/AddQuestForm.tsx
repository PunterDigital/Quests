"use client";

import { useState } from "react";
import type { QuestType } from "@/lib/types";

interface Props {
  onAdd: (name: string, type: QuestType, durationMin: number) => Promise<void>;
}

export function AddQuestForm({ onAdd }: Props) {
  const [name, setName] = useState("");
  const [type, setType] = useState<QuestType>("DAILY");
  const [dur, setDur] = useState("30");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    try {
      await onAdd(name.trim(), type, Number(dur) || 0);
      setName("");
    } catch (err) {
      alert((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const input =
    "rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-sm text-[var(--foreground)] outline-none focus:border-[var(--purple)]";

  return (
    <form
      onSubmit={submit}
      className="flex flex-col gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3"
    >
      <input
        className={input}
        placeholder="New quest… e.g. Read 20 pages"
        value={name}
        maxLength={60}
        onChange={(e) => setName(e.target.value)}
      />
      <div className="flex gap-2">
        <select
          className={`${input} flex-1`}
          value={type}
          onChange={(e) => setType(e.target.value as QuestType)}
        >
          <option value="DAILY">Daily</option>
          <option value="WEEKLY">Weekly</option>
        </select>
        <div className="flex items-center gap-1.5">
          <input
            className={`${input} w-20`}
            type="number"
            min={0}
            max={1440}
            value={dur}
            onChange={(e) => setDur(e.target.value)}
            title="Duration in minutes (0 = no limit)"
          />
          <span className="text-xs text-[var(--muted)]">min</span>
        </div>
        <button
          type="submit"
          disabled={busy || !name.trim()}
          className="rounded-lg bg-[var(--purple)] px-4 py-2 text-sm font-semibold text-[#0c0c14] transition-opacity disabled:opacity-40"
        >
          Add
        </button>
      </div>
    </form>
  );
}

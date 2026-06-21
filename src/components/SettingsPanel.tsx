"use client";

import { useState } from "react";
import { api } from "@/lib/client";
import type { QuestType, SettingsDTO } from "@/lib/types";

interface Props {
  settings: SettingsDTO;
  onChanged: () => void; // revalidate parent state
}

// Inputs are seeded from `settings`. The parent re-mounts this component (via a
// key derived from settings) when they change, so no prop->state effect sync is
// needed.
export function SettingsPanel({ settings, onChanged }: Props) {
  const [webhook, setWebhook] = useState(settings.discordWebhook ?? "");
  const [daily, setDaily] = useState(String(settings.dailyLimit));
  const [weekly, setWeekly] = useState(String(settings.weeklyLimit));
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function flash(msg: string) {
    setStatus(msg);
    setTimeout(() => setStatus(null), 3000);
  }

  async function wrap(fn: () => Promise<void>, ok: string) {
    setBusy(true);
    try {
      await fn();
      flash(ok);
    } catch (e) {
      flash(`⚠ ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  }

  const saveSettings = () =>
    wrap(async () => {
      await api.updateSettings({
        discordWebhook: webhook,
        dailyLimit: Number(daily) || 5,
        weeklyLimit: Number(weekly) || 15,
      });
      onChanged();
    }, "Settings saved");

  const reset = (scope: QuestType) =>
    wrap(async () => {
      await api.reset(scope);
      onChanged();
    }, `${scope === "DAILY" ? "Daily" : "Weekly"} quests reset`);

  const input =
    "rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-sm text-[var(--foreground)] outline-none focus:border-[var(--purple)]";
  const btn =
    "rounded-lg px-3 py-2 text-sm font-medium transition-opacity disabled:opacity-40";

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
      {/* Discord */}
      <section className="flex flex-col gap-2">
        <h3 className="text-sm font-semibold text-[var(--foreground)]">
          Discord webhook
        </h3>
        <p className="text-xs text-[var(--muted)]">
          Paste a Discord webhook URL to post quest reports.
        </p>
        <input
          className={input}
          placeholder="https://discord.com/api/webhooks/…"
          value={webhook}
          onChange={(e) => setWebhook(e.target.value)}
        />
        <div className="flex gap-2">
          <button
            className={`${btn} flex-1 bg-[var(--purple)] text-[#0c0c14]`}
            disabled={busy}
            onClick={saveSettings}
          >
            Save
          </button>
          <button
            className={`${btn} bg-[color-mix(in_srgb,var(--cyan)_14%,transparent)] text-[var(--cyan)]`}
            disabled={busy || !settings.discordWebhook}
            onClick={() =>
              wrap(async () => {
                await api.sendDiscord(true);
              }, "Report sent to Discord")
            }
          >
            Send report now
          </button>
        </div>
      </section>

      <hr className="border-[var(--border)]" />

      {/* Limits */}
      <section className="flex flex-col gap-2">
        <h3 className="text-sm font-semibold text-[var(--foreground)]">
          Active limits
        </h3>
        <p className="text-xs text-[var(--muted)]">
          Max quests active at once before extras go to the pool.
        </p>
        <div className="flex gap-3">
          <label className="flex flex-1 flex-col gap-1 text-xs text-[var(--muted)]">
            Daily
            <input
              className={input}
              type="number"
              min={1}
              max={50}
              value={daily}
              onChange={(e) => setDaily(e.target.value)}
            />
          </label>
          <label className="flex flex-1 flex-col gap-1 text-xs text-[var(--muted)]">
            Weekly
            <input
              className={input}
              type="number"
              min={1}
              max={50}
              value={weekly}
              onChange={(e) => setWeekly(e.target.value)}
            />
          </label>
        </div>
        <button
          className={`${btn} bg-[var(--purple)] text-[#0c0c14]`}
          disabled={busy}
          onClick={saveSettings}
        >
          Save limits
        </button>
      </section>

      <hr className="border-[var(--border)]" />

      {/* Resets */}
      <section className="flex flex-col gap-2">
        <h3 className="text-sm font-semibold text-[var(--foreground)]">
          Reset progress
        </h3>
        <p className="text-xs text-[var(--muted)]">
          Sets quests back to Todo and randomly draws which pooled quests become
          active this round.
        </p>
        <div className="flex gap-2">
          <button
            className={`${btn} flex-1 bg-[color-mix(in_srgb,var(--yellow)_14%,transparent)] text-[var(--yellow)]`}
            disabled={busy}
            onClick={() => {
              if (confirm("Reset all daily quests to Todo?")) reset("DAILY");
            }}
          >
            Reset daily
          </button>
          <button
            className={`${btn} flex-1 bg-[color-mix(in_srgb,var(--orange)_14%,transparent)] text-[var(--orange)]`}
            disabled={busy}
            onClick={() => {
              if (confirm("Reset all weekly quests to Todo?")) reset("WEEKLY");
            }}
          >
            Reset weekly
          </button>
        </div>
      </section>

      {status && (
        <div className="rounded-lg bg-[var(--surface-2)] px-3 py-2 text-xs text-[var(--green)]">
          {status}
        </div>
      )}
    </div>
  );
}

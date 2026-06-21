"use client";

import { useEffect, useState } from "react";
import { formatRemaining, remainingSeconds, type QuestDTO } from "@/lib/types";

// Live, ticking time-remaining display for an active timed quest.
export function Countdown({ quest }: { quest: QuestDTO }) {
  const [secs, setSecs] = useState<number | null>(() => remainingSeconds(quest));

  useEffect(() => {
    const tick = () => setSecs(remainingSeconds(quest));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [quest]);

  if (secs === null) return null;

  const color =
    secs <= 0
      ? "var(--red)"
      : secs < 300
        ? "var(--orange)"
        : "var(--foreground)";

  return (
    <span className="font-mono text-xs font-semibold" style={{ color }}>
      {secs <= 0 ? "⚠ OVERDUE" : `⏱ ${formatRemaining(secs)}`}
    </span>
  );
}

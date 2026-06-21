interface Props {
  done: number;
  total: number;
  color?: string; // CSS color
}

export function ProgressBar({ done, total, color = "var(--green)" }: Props) {
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  return (
    <div className="flex items-center gap-2">
      <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-[var(--surface-2)] ring-1 ring-[var(--border)]">
        <div
          className="h-full rounded-full transition-[width] duration-500 ease-out"
          style={{ width: `${pct}%`, background: color }}
        />
      </div>
      <span className="w-12 shrink-0 text-right font-mono text-xs text-[var(--muted)]">
        {done}/{total}
      </span>
    </div>
  );
}

// ARCHIVED 2026-10-13 · DATA-01-F6 · owner approved · excerpt from apps/admin-portal/components/PortalShell.tsx: BarRow.
// Not built, tested or imported. Restore: move the code back to that path, drop ".archived" from the name, import it.
// Every archived item and its reason: docs/engineering/data-ownership.json → archived.

/** @purpose Inline bar for a leaderboard row, sized relative to the group's max value — no chart library needed. */
export function BarRow({ label, value, max, formatted }: { label: string; value: number; max: number; formatted: string }) {
  const pct = max > 0 ? Math.max(4, Math.round((value / max) * 100)) : 0;
  return (
    <div className="flex min-w-0 items-center gap-3 border-b border-[var(--border)] py-3">
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <span className="truncate text-sm font-bold">{label}</span>
          <span className="shrink-0 text-sm font-extrabold">{formatted}</span>
        </div>
        <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-[var(--surface-muted)]">
          <div className="h-full rounded-full bg-[var(--jade)]" style={{ width: `${pct}%` }} />
        </div>
      </div>
    </div>
  );
}


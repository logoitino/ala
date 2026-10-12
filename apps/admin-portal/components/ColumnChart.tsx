/**
 * @purpose Seven-day column chart for the admin home. Inline SVG, no chart library.
 *   Values stay in the caption so the shape is not the only reading.
 */

export function ColumnChart({
  title,
  points,
  formatValue,
  accent = 'var(--jade)',
}: {
  title: string;
  points: { label: string; value: number }[];
  formatValue: (value: number) => string;
  accent?: string;
}) {
  const max = Math.max(...points.map((point) => point.value), 1);
  const summary =
    points.length === 0
      ? `${title}. No days in this read.`
      : `${title}. ${points.map((point) => `${point.label} ${formatValue(point.value)}`).join(', ')}.`;

  return (
    <figure className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4" style={{ boxShadow: 'var(--shadow-card)' }}>
      <figcaption className="text-sm font-extrabold tracking-tight">{title}</figcaption>
      <p className="mt-1 text-xs text-[var(--text-muted)]">Last 7 days, UTC. One bar per day.</p>
      {points.length === 0 ? (
        <p className="mt-6 text-sm text-[var(--text-muted)]">This read did not include the series.</p>
      ) : (
        <div className="mt-4" role="img" aria-label={summary}>
          <div className="flex h-28 items-end gap-2">
            {points.map((point, index) => {
              const height = point.value <= 0 ? 4 : Math.max(8, Math.round((point.value / max) * 112));
              return (
                <div key={`${point.label}-${index}`} className="flex h-full flex-1 items-end">
                  <div
                    className="w-full rounded-t-md"
                    style={{ height, background: accent }}
                    title={`${point.label}: ${formatValue(point.value)}`}
                  />
                </div>
              );
            })}
          </div>
          <div className="mt-2 flex gap-2">
            {points.map((point, index) => (
              <div key={`${point.label}-label-${index}`} className="min-w-0 flex-1 text-center">
                <p className="truncate text-[10px] font-bold text-[var(--text-muted)] uppercase">{point.label}</p>
                <p className="truncate text-[10px] font-extrabold text-[var(--ink)]">{formatValue(point.value)}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </figure>
  );
}

// ARCHIVED 2026-10-13 · DATA-01-F6 · owner approved · whole file apps/admin-portal/components/ColumnChart.tsx (ColumnChart).
// Not built, tested or imported. Restore: move the code back to that path, drop ".archived" from the name, import it.
// Every archived item and its reason: docs/engineering/data-ownership.json → archived.

/**
 * Back-compat wrapper (ADM-01a). The 7-day column chart now lives in the chart kit as
 * `components/charts/TrendChart`. This keeps the old name and props so AnalyticsBoard keeps
 * compiling while ANALYST moves to TrendChart (Home already did in ADM-01b). Points accept a
 * null value or a null list (not in this read), which TrendChart shows as "—". Do not add features here.
 */
import { TrendChart, type ChartColor } from './charts';

const ACCENTS: Record<string, ChartColor> = {
  'var(--jade)': 'jade',
  'var(--cyan)': 'cyan',
  'var(--gold)': 'gold',
  'var(--violet)': 'violet',
  'var(--ember)': 'bad',
};

/**
 * @purpose Seven-day column chart, now rendered by TrendChart (variant "columns").
 * @param title Chart title.
 * @param points Daily points, oldest first. Null = the series was not in this read.
 * @param formatValue Formats a value for labels, the summary, and the Data table.
 * @param accent Old CSS colour string ('var(--jade)', 'var(--gold)', 'var(--ember)', ...). Unknown values fall back to jade.
 */
export function ColumnChart({
  title,
  points,
  formatValue,
  accent = 'var(--jade)',
}: {
  title: string;
  points: { label: string; value: number | null }[] | null;
  formatValue: (value: number) => string;
  accent?: string;
}) {
  return (
    <TrendChart
      title={title}
      windowLabel="Last 7 days, UTC"
      points={points}
      format={formatValue}
      variant="columns"
      accent={ACCENTS[accent] ?? 'jade'}
    />
  );
}

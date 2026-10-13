'use client';

/**
 * Tabbed Health board (Where, Buttons, Errors, Menus). The open sections and underline tabs
 * match Home's shared report format while preserving the existing keyboard tab behavior. The server page already loaded the
 * numbers; switching tabs does not fetch again. Follows the WAI-ARIA tabs pattern: a tablist
 * with roving tabindex, Left/Right/Home/End keys (automatic activation), and one tabpanel per
 * tab wired with aria-controls / aria-labelledby. Values arrive as plain data with a unit name;
 * the formatters live on this side because functions cannot cross from a server page. A read
 * failure is one alert above the tabs (not repeated in each panel), and chart and tile grids
 * pick their column count from how many items they hold so no row ends with a lone half card.
 */
import { useId, useRef, useState, type KeyboardEvent } from 'react';

import { HBarList, SplitBar, StatTile, TrendChart, type ChartFormat } from '@/components/charts';
import { Badge } from '@/components/PortalShell';
import { formatCompactCount } from '@/lib/dashboard';
import { formatOperationsValue, type OperationsKind, type OperationsLens, type OperationsTabId } from '@/lib/operations';

const FORMATS: Record<OperationsKind, ChartFormat> = {
  count: (value) => formatOperationsValue('count', value),
  minutes: (value) => formatOperationsValue('minutes', value),
  percent: (value) => formatOperationsValue('percent', value),
  ms: (value) => formatOperationsValue('ms', value),
  ratio: (value) => formatOperationsValue('ratio', value),
};

// Gridlines on round display units: whole minutes for ms-as-minutes.
const TICK_UNIT: Partial<Record<OperationsKind, number>> = { minutes: 60000 };

const TAB_ICONS: Record<OperationsTabId, string> = {
  where: 'M3 12h4l3-8 4 16 3-8h4',
  buttons: 'M9 9V5a3 3 0 0 1 6 0v4m-8 0h10l-1 11H8L7 9Z',
  errors: 'M12 3 2 20h20L12 3Zm0 6v5m0 3v.5',
  menus: 'M4 6h16M4 12h16M4 18h10',
};

/**
 * @purpose Show one Health lens at a time: a sentence, tiles, charts, then every smaller row.
 * @param lenses Where, Buttons, Errors, and Menus, already ranked by `buildOperations`.
 * @returns The tab row and the tab panels (inactive panels are `hidden`).
 */
export function OperationsBoard({ lenses }: { lenses: OperationsLens[] }) {
  const [active, setActive] = useState<OperationsTabId>(lenses[0]?.id ?? 'where');
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const baseId = useId();
  if (lenses.length === 0) return null;
  const activeIndex = Math.max(0, lenses.findIndex((lens) => lens.id === active));
  const tabId = (id: OperationsTabId) => `${baseId}-tab-${id}`;
  const panelId = (id: OperationsTabId) => `${baseId}-panel-${id}`;
  // Every lens carries the same read failures; announce them once, outside the tab panels.
  const alerts = [...new Set(lenses.flatMap((lens) => lens.alerts))];

  const focusTab = (index: number) => {
    const next = (index + lenses.length) % lenses.length;
    setActive(lenses[next].id);
    tabRefs.current[next]?.focus();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === 'ArrowRight') focusTab(activeIndex + 1);
    else if (event.key === 'ArrowLeft') focusTab(activeIndex - 1);
    else if (event.key === 'Home') focusTab(0);
    else if (event.key === 'End') focusTab(lenses.length - 1);
    else return;
    event.preventDefault();
  };

  return (
    <div>
      {alerts.length > 0 ? (
        <div role="alert" className="mb-4 space-y-2">
          {alerts.map((alert) => (
            <p key={alert} className="rounded-xl border border-[var(--ember)]/30 bg-[var(--ember-soft)] px-4 py-3 text-sm font-semibold text-[var(--ember)]">
              {alert}
            </p>
          ))}
        </div>
      ) : null}
      <div
        role="tablist"
        aria-label="Health"
        className="mb-8 grid grid-cols-2 gap-x-3 gap-y-1 border-b border-[var(--border)] sm:inline-grid sm:grid-cols-4"
      >
        {lenses.map((item, index) => {
          const on = index === activeIndex;
          return (
            <button
              key={item.id}
              ref={(node) => {
                tabRefs.current[index] = node;
              }}
              id={tabId(item.id)}
              type="button"
              role="tab"
              aria-selected={on}
              aria-controls={panelId(item.id)}
              tabIndex={on ? 0 : -1}
              onClick={() => setActive(item.id)}
              onKeyDown={onKeyDown}
              className={`inline-flex min-h-10 items-center justify-center gap-2 border-b-2 px-3 text-sm font-extrabold ${
                on
                  ? 'border-[var(--jade)] text-[var(--jade)]'
                  : 'border-transparent text-[var(--ink-soft)] hover:border-[var(--border)] hover:text-[var(--ink)]'
              }`}
            >
              <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d={TAB_ICONS[item.id]} />
              </svg>
              {item.label}
            </button>
          );
        })}
      </div>

      {lenses.map((lens, index) => (
        <div
          key={lens.id}
          id={panelId(lens.id)}
          role="tabpanel"
          aria-labelledby={tabId(lens.id)}
          tabIndex={0}
          hidden={index !== activeIndex}
          className="rounded-2xl"
        >
          {index === activeIndex ? <LensPanel lens={lens} /> : null}
        </div>
      ))}
    </div>
  );
}

/** Tile columns that leave no orphan: 4 → 2 then 4, 3 → 3, 6 → 2 then 3, otherwise 2 then 3. */
function tileColumns(count: number): string {
  if (count % 4 === 0) return 'sm:grid-cols-2 lg:grid-cols-4';
  if (count === 3) return 'md:grid-cols-3';
  if (count % 3 === 0) return 'sm:grid-cols-2 lg:grid-cols-3';
  return 'sm:grid-cols-2 xl:grid-cols-3';
}

function chartCount(lens: OperationsLens): number {
  return lens.series.length + lens.rankings.length;
}

/** With an odd number of charts in a two-column grid, the last one takes the full row. */
function spanLast(lens: OperationsLens, index: number): string {
  const count = chartCount(lens);
  return count > 1 && count % 2 === 1 && index === count - 1 ? 'lg:col-span-2' : '';
}

function LensPanel({ lens }: { lens: OperationsLens }) {
  return (
    <div className="space-y-6">
      <p className="text-base leading-7 font-semibold text-[var(--ink)]">{lens.summary}</p>

      {lens.stats.length > 0 ? (
        <div className={`grid gap-3 ${tileColumns(lens.stats.length)}`}>
          {lens.stats.map((stat) => (
            <StatTile
              key={stat.key}
              label={stat.label}
              value={stat.value == null ? '—' : FORMATS[stat.kind](stat.value)}
              missing={stat.value == null}
              hint={stat.hint}
              tone={stat.tone}
              goodDirection={stat.goodDirection}
              spark={stat.spark ? { points: stat.spark.points, format: FORMATS[stat.kind], accent: stat.spark.accent } : undefined}
            />
          ))}
        </div>
      ) : null}

      {lens.series.length > 0 || lens.rankings.length > 0 ? (
        <div className={`grid gap-4 ${chartCount(lens) > 1 ? 'lg:grid-cols-2' : ''}`}>
          {lens.series.map((series, index) => (
            <div key={series.source} className={`min-w-0 ${spanLast(lens, index)}`}>
              <TrendChart
                title={series.title}
                windowLabel="Last 7 days, UTC"
                points={series.points}
                format={FORMATS[series.kind]}
                variant={series.variant}
                accent={series.accent}
                source={series.source}
                tickUnit={TICK_UNIT[series.kind]}
                tickFormat={series.kind === 'count' ? formatCompactCount : undefined}
              />
            </div>
          ))}
          {lens.rankings.map((ranking, index) => (
            <div key={ranking.source} className={`min-w-0 ${spanLast(lens, lens.series.length + index)}`}>
              <HBarList
                title={ranking.title}
                caption={ranking.caption}
                rows={ranking.rows}
                format={FORMATS[ranking.kind]}
                accent={ranking.accent}
                emptyText={ranking.emptyText}
                source={ranking.source}
                summary={ranking.summary}
              />
            </div>
          ))}
        </div>
      ) : null}

      {lens.splits.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2">
          {lens.splits.map((split) => (
            <SplitBar
              key={split.id}
              title={split.title}
              caption={split.caption}
              totalLabel="Switches"
              source={`app_runtime_config.published.${split.id}`}
              format={FORMATS.count}
              parts={[
                { label: 'On', value: split.on, color: 'jade' },
                { label: 'Off', value: split.off, color: 'muted' },
              ]}
            />
          ))}
        </div>
      ) : null}

      <section aria-label={`${lens.label}: every row`} className="portal-panel min-w-0 border-t border-[var(--border)] pt-5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-base font-extrabold tracking-tight">Every row</h2>
          <p className="text-xs text-[var(--text-muted)]">{lens.details.length.toLocaleString('en-US')} rows</p>
        </div>
        {lens.details.length === 0 ? (
          <p className="mt-3 text-sm text-[var(--text-muted)]">No smaller rows for this tab in this read.</p>
        ) : (
          <dl className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {lens.details.map((row, index) => (
              <div key={`${row.label}-${index}`} className="flex min-w-0 items-center justify-between gap-3 border-b border-[var(--border)] py-3">
                <dt className="min-w-0 text-sm break-words text-[var(--ink-soft)]">{row.label}</dt>
                {row.value === 'On' || row.value === 'Off' ? (
                  // The badge never shrinks, so "On" / "Off" never splits across two lines.
                  <dd className="shrink-0 whitespace-nowrap">
                    <Badge tone={row.value === 'On' ? 'ok' : 'warn'}>{row.value}</Badge>
                  </dd>
                ) : (
                  // The value never shrinks or wraps (a long label wraps instead), so "22" never splits at 320px.
                  <dd className="chart-tabular shrink-0 whitespace-nowrap text-right text-sm font-extrabold">{row.value}</dd>
                )}
              </div>
            ))}
          </dl>
        )}
      </section>
    </div>
  );
}

'use client';

/**
 * Tabbed operations board. The server page already loaded the numbers. Switching tabs does not fetch again.
 */
import { useState } from 'react';

import { BarRow, Panel } from '@/components/PortalShell';
import type { OperationsLens, OperationsTabId } from '@/lib/operations';

/**
 * @purpose Show one operations lens at a time: a sentence, the bars, then every smaller row.
 * @param lenses Where, Buttons, Errors, and Menus, already ranked.
 * @returns The tab row and the active lens.
 */
export function OperationsBoard({ lenses }: { lenses: OperationsLens[] }) {
  const [active, setActive] = useState<OperationsTabId>(lenses[0]?.id ?? 'where');
  const lens = lenses.find((item) => item.id === active) ?? lenses[0];
  if (!lens) return null;
  const max = Math.max(...lens.bars.map((row) => row.value), 1);

  return (
    <div>
      <div className="mb-6 flex flex-wrap gap-2" role="tablist" aria-label="Operations">
        {lenses.map((item) => {
          const on = item.id === lens.id;
          return (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={on}
              onClick={() => setActive(item.id)}
              className={
                on
                  ? 'rounded-full bg-[var(--jade)] px-4 py-2 text-sm font-extrabold text-white'
                  : 'rounded-full border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-sm font-extrabold text-[var(--ink)]'
              }
            >
              {item.label}
            </button>
          );
        })}
      </div>
      <Panel title={lens.label} kicker="Operations">
        <p className="text-sm font-semibold leading-6 text-[var(--ink)]">{lens.summary}</p>
        {lens.bars.length === 0 ? (
          <p className="text-sm text-[var(--text-muted)]">Nothing in this window yet.</p>
        ) : (
          <div className="space-y-2">
            {lens.bars.map((row) => (
              <BarRow key={row.label} label={row.label} value={row.value} max={max} formatted={row.value.toLocaleString()} />
            ))}
          </div>
        )}
      </Panel>
      <div className="mt-4">
        <Panel title="Every row" kicker="Detail">
          {lens.details.length === 0 ? (
            <p className="text-sm text-[var(--text-muted)]">No smaller rows for this tab.</p>
          ) : (
            <dl className="grid gap-2 sm:grid-cols-2">
              {lens.details.map((row) => (
                <div key={`${row.label}-${row.value}`} className="flex items-center justify-between gap-3 rounded-xl border border-[var(--border)] px-3 py-2">
                  <dt className="text-sm text-[var(--ink-soft)]">{row.label}</dt>
                  <dd className="text-sm font-extrabold">{row.value}</dd>
                </div>
              ))}
            </dl>
          )}
        </Panel>
      </div>
    </div>
  );
}

import Link from 'next/link';
import type { ReactNode } from 'react';

const NAV = [
  { href: '/', label: 'Overview' },
  { href: '/auth', label: 'Soft-Wall' },
  { href: '/features', label: 'Features' },
  { href: '/people', label: 'People' },
] as const;

/**
 * @purpose Daylight shell for the Next Soft-Wall oversight portal (jade / gold, not Expo desks).
 */
export function PortalShell({
  children,
  active,
}: {
  children: ReactNode;
  active: (typeof NAV)[number]['href'];
}) {
  return (
    <div className="min-h-screen bg-[var(--canvas)] text-[var(--ink)]">
      <header className="border-b border-emerald-900/10 bg-white/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-6 py-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[11px] font-extrabold tracking-[0.2em] text-[var(--gold)] uppercase">
              Tapua&apos;i admin portal
            </p>
            <h1 className="mt-1 text-2xl font-extrabold tracking-tight">Soft-Wall control plane</h1>
            <p className="mt-1 max-w-xl text-sm leading-6 text-slate-600">
              Live oversight for browse-first guests, Soft-Wall auth, and Features flags. Full desks still ship in Expo{' '}
              <code className="rounded bg-emerald-50 px-1.5 py-0.5 text-[var(--jade)]">/admin</code>.
            </p>
          </div>
          <nav className="flex flex-wrap gap-2">
            {NAV.map((item) => {
              const on = item.href === active;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={
                    on
                      ? 'rounded-full bg-[var(--jade)] px-4 py-2 text-sm font-bold text-white'
                      : 'rounded-full border border-emerald-900/10 bg-white px-4 py-2 text-sm font-bold text-slate-700 hover:border-[var(--jade)]'
                  }
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-6 py-10">{children}</main>
    </div>
  );
}

export function StatCard({
  label,
  value,
  hint,
  tone = 'neutral',
}: {
  label: string;
  value: string;
  hint: string;
  tone?: 'neutral' | 'ok' | 'warn';
}) {
  const rim =
    tone === 'ok'
      ? 'border-emerald-300 bg-emerald-50/80'
      : tone === 'warn'
        ? 'border-amber-300 bg-amber-50/80'
        : 'border-emerald-900/10 bg-white';
  return (
    <div className={`rounded-2xl border p-4 shadow-sm ${rim}`}>
      <p className="text-[11px] font-extrabold tracking-wide text-slate-500 uppercase">{label}</p>
      <p className="mt-2 text-2xl font-extrabold tracking-tight text-[var(--ink)]">{value}</p>
      <p className="mt-1 text-sm leading-5 text-slate-600">{hint}</p>
    </div>
  );
}

export function Panel({
  title,
  children,
  kicker,
}: {
  title: string;
  children: ReactNode;
  kicker?: string;
}) {
  return (
    <section className="rounded-2xl border border-emerald-900/10 bg-white p-5 shadow-sm">
      {kicker ? (
        <p className="text-[11px] font-extrabold tracking-[0.16em] text-[var(--gold)] uppercase">{kicker}</p>
      ) : null}
      <h2 className="mt-1 text-lg font-extrabold tracking-tight">{title}</h2>
      <div className="mt-4 space-y-3">{children}</div>
    </section>
  );
}

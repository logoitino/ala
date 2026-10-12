import Link from 'next/link';
import type { ReactNode } from 'react';

import { SignOutButton } from '@/components/SignOutButton';
import { APP_RUNTIME_FLAG_GROUPS, type AppRuntimeFlagGroup } from '@tapuai/shared-types';

export type PortalHref =
  | '/'
  | '/reports'
  | '/audience'
  | '/money'
  | '/operations'
  | '/manage'
  | '/analytics'
  | '/product'
  | '/features'
  | '/profile'
  | '/auth'
  | '/people';

const TABS: { href: PortalHref; label: string; match: PortalHref[] }[] = [
  { href: '/', label: 'Home', match: ['/'] },
  { href: '/reports', label: 'Trends', match: ['/reports'] },
  { href: '/audience', label: 'Audience', match: ['/audience'] },
  { href: '/money', label: 'Revenue', match: ['/money'] },
  { href: '/operations', label: 'Health', match: ['/operations'] },
  { href: '/product', label: 'Product', match: ['/product', '/features', '/profile', '/auth', '/people'] },
];

const PRODUCT_LINKS: { href: PortalHref; label: string }[] = [
  { href: '/features', label: 'Features' },
  { href: '/profile', label: 'Profile' },
  { href: '/auth', label: 'Sign-in' },
  { href: '/people', label: 'People' },
];

const TITLES: Record<PortalHref, string> = {
  '/': 'Home',
  '/reports': 'Trends',
  '/audience': 'Audience',
  '/money': 'Revenue',
  '/operations': 'Health',
  '/manage': 'Departments',
  '/analytics': 'Analytics',
  '/product': 'Product',
  '/features': 'Features',
  '/profile': 'Profile',
  '/auth': 'Sign-in',
  '/people': 'People',
};

function tabClass(on: boolean) {
  return on
    ? 'flex h-11 items-center justify-center rounded-lg bg-[var(--jade)] text-sm font-extrabold text-white'
    : 'flex h-11 items-center justify-center rounded-lg text-sm font-extrabold text-[var(--ink-soft)] hover:bg-[var(--surface-muted)]';
}

/**
 * @purpose Top bar for the Next admin portal. Six equal tabs. Product opens a second equal row.
 *   Departments is a utility link, not a seventh uneven category.
 */
export function PortalShell({ children, active }: { children: ReactNode; active: PortalHref }) {
  const productOpen = TABS[5].match.includes(active);

  return (
    <div className="min-h-screen bg-[var(--canvas)] text-[var(--ink)]">
      <header className="border-b border-[var(--border)] bg-[var(--surface)]">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <div className="min-w-0">
            <p className="text-[10px] font-extrabold tracking-[0.2em] text-[var(--jade)] uppercase">Tapua&apos;i</p>
            <h1 className="truncate text-lg font-extrabold tracking-tight">{TITLES[active]}</h1>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Link
              href="/analytics"
              className={
                active === '/analytics'
                  ? 'inline-flex h-11 items-center rounded-lg bg-[var(--jade-soft)] px-3 text-sm font-extrabold text-[var(--jade)]'
                  : 'inline-flex h-11 items-center rounded-lg px-3 text-sm font-extrabold text-[var(--ink-soft)] hover:bg-[var(--surface-muted)]'
              }
            >
              Analytics
            </Link>
            <Link
              href="/manage"
              className={
                active === '/manage'
                  ? 'inline-flex h-11 items-center rounded-lg bg-[var(--jade-soft)] px-3 text-sm font-extrabold text-[var(--jade)]'
                  : 'inline-flex h-11 items-center rounded-lg px-3 text-sm font-extrabold text-[var(--ink-soft)] hover:bg-[var(--surface-muted)]'
              }
            >
              Departments
            </Link>
            <SignOutButton />
          </div>
        </div>
        <nav aria-label="Portal" className="mx-auto grid w-full max-w-7xl grid-cols-3 gap-1 px-4 pb-3 sm:grid-cols-6 sm:px-6">
          {TABS.map((tab) => (
            <Link key={tab.href} href={tab.href} className={tabClass(tab.match.includes(active))} aria-current={tab.match.includes(active) ? 'page' : undefined}>
              {tab.label}
            </Link>
          ))}
        </nav>
        {productOpen ? (
          <nav aria-label="Product" className="mx-auto grid w-full max-w-7xl grid-cols-2 gap-1 px-4 pb-3 sm:grid-cols-4 sm:px-6">
            {PRODUCT_LINKS.map((link) => (
              <Link key={link.href} href={link.href} className={tabClass(link.href === active)}>
                {link.label}
              </Link>
            ))}
          </nav>
        ) : null}
      </header>
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6">{children}</main>
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
  tone?: 'neutral' | 'ok' | 'warn' | 'danger';
}) {
  const accent =
    tone === 'ok'
      ? 'text-[var(--jade)]'
      : tone === 'warn'
        ? 'text-[var(--gold)]'
        : tone === 'danger'
          ? 'text-[var(--ember)]'
          : 'text-[var(--ink)]';
  return (
    <div
      className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4"
      style={{ boxShadow: 'var(--shadow-card)' }}
    >
      <p className="text-[11px] font-extrabold tracking-wide text-[var(--text-muted)] uppercase">{label}</p>
      <p className={`mt-2 text-2xl font-extrabold tracking-tight ${accent}`}>{value}</p>
      <p className="mt-1 text-sm leading-5 text-[var(--ink-soft)]">{hint}</p>
    </div>
  );
}

export function Panel({
  title,
  children,
  kicker,
  action,
}: {
  title: string;
  children: ReactNode;
  kicker?: string;
  action?: ReactNode;
}) {
  return (
    <section
      className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5"
      style={{ boxShadow: 'var(--shadow-card)' }}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          {kicker ? (
            <p className="text-[11px] font-extrabold tracking-[0.16em] text-[var(--gold)] uppercase">{kicker}</p>
          ) : null}
          <h2 className="mt-1 text-lg font-extrabold tracking-tight">{title}</h2>
        </div>
        {action ? <div className="shrink-0 pt-0.5">{action}</div> : null}
      </div>
      <div className="mt-4 space-y-3">{children}</div>
    </section>
  );
}

/** @purpose Section header for grouping related Panels in a dashboard grid (Reports, Overview). */
export function SectionHeading({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="mb-3 flex items-baseline justify-between gap-3">
      <h3 className="text-sm font-extrabold tracking-[0.08em] text-[var(--ink-soft)] uppercase">{title}</h3>
      {hint ? <p className="text-xs text-[var(--text-muted)]">{hint}</p> : null}
    </div>
  );
}

/** @purpose Small status chip — replaces the on/off/live/paused className duplicated across every page. */
export function Badge({ tone, children }: { tone: 'ok' | 'warn' | 'neutral' | 'danger'; children: ReactNode }) {
  const cls =
    tone === 'ok'
      ? 'bg-[var(--jade-soft)] text-[var(--jade)]'
      : tone === 'warn'
        ? 'bg-[var(--gold-soft)] text-[var(--gold)]'
        : tone === 'danger'
          ? 'bg-[var(--ember-soft)] text-[var(--ember)]'
          : 'bg-[var(--surface-muted)] text-[var(--ink-soft)]';
  return <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${cls}`}>{children}</span>;
}

/** @purpose Inline bar for a leaderboard row, sized relative to the group's max value — no chart library needed. */
export function BarRow({ label, value, max, formatted }: { label: string; value: number; max: number; formatted: string }) {
  const pct = max > 0 ? Math.max(4, Math.round((value / max) * 100)) : 0;
  return (
    <div className="flex items-center gap-3 rounded-xl border border-[var(--border)] px-3 py-2">
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

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function readFlag(bag: Record<string, unknown>, path: string): boolean {
  const [root, key] = path.split('.');
  if (!root || !key) return true;
  const group = bag[root];
  if (!isPlainObject(group)) return true;
  const value = group[key];
  return typeof value === 'boolean' ? value : true;
}

/**
 * @purpose Read-only flag status — this portal is oversight only; all edits happen in Expo /admin
 *   (Features / Look desks). Renders live (published) state as plain Badges, no toggle affordance.
 * @param published `app_runtime_config.published` bag.
 * @param groupIds Limit to specific flag groups (e.g. `['profile']` on the Profile desk); omit for all.
 */
export function FlagStatusList({
  published,
  groupIds,
}: {
  published: Record<string, unknown>;
  groupIds?: AppRuntimeFlagGroup['id'][];
}) {
  const groups = APP_RUNTIME_FLAG_GROUPS.filter((group) => !groupIds || groupIds.includes(group.id));
  return (
    <div className="space-y-6">
      {groups.map((group) => (
        <div key={group.id}>
          <p className="text-sm font-extrabold tracking-wide text-[var(--gold)] uppercase">{group.label}</p>
          <p className="mt-1 text-sm text-[var(--ink-soft)]">{group.hint}</p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {group.flags.map((row) => {
              const on = readFlag(published, row.path);
              return (
                <div
                  key={row.path}
                  className="flex items-center justify-between gap-3 rounded-xl border border-[var(--border)] px-4 py-3"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold">{row.label}</p>
                    <p className="truncate text-xs text-[var(--text-muted)]">{row.hint}</p>
                  </div>
                  <Badge tone={on ? 'ok' : 'warn'}>{on ? 'On' : 'Off'}</Badge>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

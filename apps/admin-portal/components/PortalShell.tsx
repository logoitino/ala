import Link from 'next/link';
import type { ReactNode } from 'react';

import { SignOutButton } from '@/components/SignOutButton';
import { APP_RUNTIME_FLAG_GROUPS, type AppRuntimeFlagGroup } from '@tapuai/shared-types';

type NavHref = '/' | '/reports' | '/money' | '/auth' | '/profile' | '/features' | '/people';

type NavItem = { href: NavHref; label: string; hint: string };

const NAV_GROUPS: { title: string; items: NavItem[] }[] = [
  { title: '', items: [{ href: '/', label: 'Overview', hint: 'At a glance' }] },
  {
    title: 'Insights',
    items: [
      { href: '/reports', label: 'Reports', hint: 'Behavior & usage' },
      { href: '/money', label: 'Money', hint: 'Revenue ledger' },
    ],
  },
  {
    title: 'Product',
    items: [
      { href: '/features', label: 'Features', hint: 'Runtime chrome' },
      { href: '/profile', label: 'Profile', hint: 'Profile hierarchy' },
    ],
  },
  {
    title: 'Audience',
    items: [
      { href: '/auth', label: 'Soft-Wall', hint: 'Auth gates' },
      { href: '/people', label: 'People', hint: 'Fan roster' },
    ],
  },
];

const ALL_ITEMS = NAV_GROUPS.flatMap((group) => group.items);

/**
 * @purpose Sidebar shell for the Next web admin portal. Grouped nav (Insights / Product / Audience) so new
 *   desks (Billing, Marketing — planned) have an obvious home instead of one flat row of tabs.
 */
export function PortalShell({ children, active }: { children: ReactNode; active: NavHref }) {
  const current = ALL_ITEMS.find((item) => item.href === active);

  return (
    <div className="flex min-h-screen bg-[var(--canvas)] text-[var(--ink)]">
      <aside className="hidden w-64 shrink-0 flex-col bg-[var(--sidebar-bg)] px-4 py-6 text-[var(--sidebar-ink)] lg:flex">
        <div className="px-2 pb-6">
          <p className="text-[10px] font-extrabold tracking-[0.24em] text-emerald-400/80 uppercase">Tapua&apos;i</p>
          <p className="mt-0.5 text-lg font-extrabold tracking-tight text-white">Admin Portal</p>
        </div>
        <nav className="flex-1 space-y-6">
          {NAV_GROUPS.map((group, i) => (
            <div key={group.title || `group-${i}`}>
              {group.title ? (
                <p className="mb-1.5 px-2 text-[10px] font-extrabold tracking-[0.16em] text-emerald-400/60 uppercase">
                  {group.title}
                </p>
              ) : null}
              <div className="space-y-0.5">
                {group.items.map((item) => {
                  const on = item.href === active;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={
                        on
                          ? 'flex flex-col rounded-xl bg-[var(--sidebar-active)] px-3 py-2 text-white'
                          : 'flex flex-col rounded-xl px-3 py-2 text-[var(--sidebar-ink)] hover:bg-white/5'
                      }
                    >
                      <span className="text-sm font-bold">{item.label}</span>
                      <span className="text-xs opacity-60">{item.hint}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>
        <div className="mt-6 rounded-xl border border-white/10 px-3 py-3">
          <p className="text-xs leading-5 text-emerald-100/70">
            This portal is read-only oversight. Every change — Games, Catalogs, Features, Look, all of it —
            happens in Expo <code className="text-emerald-300">/admin</code>.
          </p>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between gap-4 border-b border-[var(--border)] bg-[var(--surface)] px-6 py-4 lg:px-10">
          <div className="min-w-0">
            <p className="truncate text-[11px] font-extrabold tracking-[0.14em] text-[var(--text-muted)] uppercase lg:hidden">
              Tapua&apos;i admin portal
            </p>
            <h1 className="truncate text-xl font-extrabold tracking-tight">{current?.label ?? 'Admin Portal'}</h1>
          </div>
          <div className="flex shrink-0 items-center gap-3">
            <nav className="flex items-center gap-1 lg:hidden">
              {ALL_ITEMS.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={
                    item.href === active
                      ? 'rounded-full bg-[var(--jade)] px-3 py-1.5 text-xs font-bold text-white'
                      : 'rounded-full border border-[var(--border)] px-3 py-1.5 text-xs font-bold text-[var(--ink-soft)]'
                  }
                >
                  {item.label}
                </Link>
              ))}
            </nav>
            <SignOutButton />
          </div>
        </header>
        <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-8 lg:px-10 lg:py-10">{children}</main>
      </div>
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
export function Badge({ tone, children }: { tone: 'ok' | 'warn' | 'neutral'; children: ReactNode }) {
  const cls =
    tone === 'ok'
      ? 'bg-[var(--jade-soft)] text-[var(--jade)]'
      : tone === 'warn'
        ? 'bg-[var(--gold-soft)] text-[var(--gold)]'
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

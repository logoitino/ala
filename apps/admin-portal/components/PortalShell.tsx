/**
 * Shell for every page of the read-only Next admin portal: brand, the six equal section tabs,
 * the Analytics and Departments utility links, sign out, the page title, and the shared card
 * primitives (StatCard, Panel, SectionHeading, Badge, BarRow, FlagStatusList). Exports and their
 * props are frozen because Trends, Revenue, Analytics, and the product desks import them.
 * Owner: PORTAL. The Analytics header link is shared with ANALYST.
 */
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

const TABS: { href: PortalHref; label: string; match: PortalHref[]; icon: string }[] = [
  { href: '/', label: 'Home', match: ['/'], icon: 'M3 11.5 12 4l9 7.5M5.5 9.5V20h13V9.5' },
  { href: '/reports', label: 'Trends', match: ['/reports'], icon: 'M3 17l6-6 4 4 8-8M15 7h6v6' },
  { href: '/audience', label: 'Audience', match: ['/audience'], icon: 'M16 19v-1a4 4 0 0 0-8 0v1M12 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm7 8v-1a3 3 0 0 0-2-2.8M17 5.2a3 3 0 0 1 0 5.6' },
  { href: '/money', label: 'Revenue', match: ['/money'], icon: 'M12 3v18M16.5 7.5c0-1.7-2-3-4.5-3s-4.5 1.3-4.5 3 2 2.6 4.5 3 4.5 1.3 4.5 3-2 3-4.5 3-4.5-1.3-4.5-3' },
  { href: '/operations', label: 'Health', match: ['/operations'], icon: 'M3 12h4l3-8 4 16 3-8h4' },
  { href: '/product', label: 'Product', match: ['/product', '/features', '/profile', '/auth', '/people'], icon: 'M4 7l8-4 8 4-8 4-8-4Zm0 5 8 4 8-4M4 17l8 4 8-4' },
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

/** One line under the page title, so each page says what it is for. */
const SUBTITLES: Record<PortalHref, string> = {
  '/': 'The measured week: donations, clips, attention, and playback, with what is not measured.',
  '/reports': 'How the numbers move over the last 7 days.',
  '/audience': 'Who is on the platform: profiles, athletes, schools, and the clip mix.',
  '/money': 'Donations and the ledger, read from the recorded rows.',
  '/operations': 'Where people spend time, what they tap, what breaks, and which menus are on.',
  '/manage': 'Billing, Marketing, Support, API, and IT on one read-only page.',
  '/analytics': 'Dashboards and the measure catalog. Every number names its source.',
  '/product': 'Menus, profile, sign-in, and people. Changes stay in Expo /admin.',
  '/features': 'Which menus are on. Changes stay in Expo /admin.',
  '/profile': 'What the profile screen is allowed to show.',
  '/auth': 'Which actions ask a guest to create an account.',
  '/people': 'Who has a profile. Granting access stays in Expo /admin.',
};

function Icon({ d }: { d: string }) {
  return (
    <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24" className="size-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d={d} />
    </svg>
  );
}

function tabClass(on: boolean) {
  return on
    ? 'flex min-h-10 items-center justify-center gap-2 rounded-xl bg-[var(--surface)] px-3 text-sm font-extrabold text-[var(--jade)] shadow-[var(--shadow-card)] ring-1 ring-[var(--border)]'
    : 'flex min-h-10 items-center justify-center gap-2 rounded-xl px-3 text-sm font-bold text-[var(--ink-soft)] hover:bg-[var(--surface)]/70 hover:text-[var(--ink)]';
}

function utilityClass(on: boolean) {
  return on
    ? 'inline-flex min-h-10 items-center gap-1.5 rounded-xl bg-[var(--jade-soft)] px-3 text-sm font-extrabold text-[var(--jade)]'
    : 'inline-flex min-h-10 items-center gap-1.5 rounded-xl px-3 text-sm font-bold text-[var(--ink-soft)] hover:bg-[var(--surface-muted)] hover:text-[var(--ink)]';
}

function subClass(on: boolean) {
  return on
    ? 'inline-flex min-h-9 items-center justify-center rounded-full bg-[var(--jade)] px-4 text-sm font-extrabold text-white'
    : 'inline-flex min-h-9 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--surface)] px-4 text-sm font-bold text-[var(--ink-soft)] hover:border-[var(--jade)] hover:text-[var(--ink)]';
}

/**
 * @purpose Page frame for the admin portal. Six equal tabs in a segmented bar; Product opens a
 *   second row for its four desks. Analytics and Departments are utility links, not a seventh
 *   uneven tab. The header is sticky only on wide screens so it never covers content at 200% zoom.
 * @param active The current route; drives the title, the subtitle, and every active state.
 */
export function PortalShell({ children, active }: { children: ReactNode; active: PortalHref }) {
  const productOpen = TABS[5].match.includes(active);

  return (
    <div className="min-h-screen bg-[var(--canvas)] text-[var(--ink)]">
      <a
        href="#portal-main"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-xl focus:bg-[var(--surface)] focus:px-4 focus:py-2 focus:text-sm focus:font-extrabold focus:text-[var(--jade)] focus:shadow-lg"
      >
        Skip to content
      </a>
      <header className="border-b border-[var(--border)] bg-[var(--surface)]/95 backdrop-blur lg:sticky lg:top-0 lg:z-30">
        <div className="mx-auto flex w-full max-w-7xl flex-wrap items-center gap-x-4 gap-y-3 px-4 py-3 sm:px-6">
          <Link href="/" className="flex min-h-10 shrink-0 items-center gap-2.5 rounded-xl pr-2">
            <span aria-hidden="true" className="grid size-9 place-items-center rounded-xl bg-[var(--jade)] text-base font-black text-white shadow-[var(--shadow-card)]">
              T
            </span>
            <span className="leading-tight">
              <span className="block text-sm font-extrabold tracking-tight text-[var(--ink)]">Tapua&apos;i</span>
              <span className="block text-[11px] font-bold tracking-[0.12em] text-[var(--text-muted)] uppercase">Admin · read only</span>
            </span>
          </Link>
          <nav aria-label="Portal" className="order-3 w-full xl:order-none xl:w-auto xl:flex-1">
            <ul className="grid grid-cols-3 gap-1 rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)] p-1 sm:grid-cols-6 xl:mx-auto xl:max-w-3xl">
              {TABS.map((tab) => {
                const on = tab.match.includes(active);
                return (
                  <li key={tab.href} className="min-w-0">
                    <Link href={tab.href} className={tabClass(on)} aria-current={on ? 'page' : undefined}>
                      <span className="hidden 2xl:inline-flex">
                        <Icon d={tab.icon} />
                      </span>
                      <span className="truncate">{tab.label}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>
          <div className="ml-auto flex min-w-0 flex-wrap items-center justify-end gap-1">
            <Link href="/analytics" className={utilityClass(active === '/analytics')} aria-current={active === '/analytics' ? 'page' : undefined}>
              <span className="hidden sm:inline-flex">
                <Icon d="M4 20V10m6 10V4m6 16v-7m4 7H2" />
              </span>
              Analytics
            </Link>
            <Link href="/manage" className={utilityClass(active === '/manage')} aria-current={active === '/manage' ? 'page' : undefined}>
              <span className="hidden sm:inline-flex">
                <Icon d="M4 5h7v6H4zM13 5h7v4h-7zM13 11h7v8h-7zM4 13h7v6H4z" />
              </span>
              Departments
            </Link>
            <span aria-hidden="true" className="mx-1 hidden h-6 w-px bg-[var(--border)] sm:block" />
            <SignOutButton />
          </div>
        </div>
        {productOpen ? (
          <nav aria-label="Product" className="border-t border-[var(--border)] bg-[var(--surface)]">
            <ul className="mx-auto flex w-full max-w-7xl flex-wrap gap-2 px-4 py-2.5 sm:px-6">
              {PRODUCT_LINKS.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className={subClass(link.href === active)} aria-current={link.href === active ? 'page' : undefined}>
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ) : null}
      </header>
      <main id="portal-main" tabIndex={-1} className="mx-auto w-full max-w-7xl flex-1 px-4 pt-6 pb-16 outline-none sm:px-6 sm:pt-8">
        <div className="mb-6 border-b border-[var(--border)] pb-5">
          <p className="text-[11px] font-extrabold tracking-[0.18em] text-[var(--jade)] uppercase">
            {productOpen && active !== '/product' ? 'Product' : "Tapua'i admin"}
          </p>
          <h1 className="mt-1 text-2xl font-extrabold tracking-tight sm:text-3xl">{TITLES[active]}</h1>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-[var(--ink-soft)]">{SUBTITLES[active]}</p>
        </div>
        {children}
      </main>
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

/**
 * @purpose Section header for grouping related Panels in a dashboard grid.
 * @param id Optional id so a `<section aria-labelledby>` can name itself after this heading.
 * @param level Heading level, default 3 (unchanged for older pages). Pages under the shell's h1 use 2.
 */
export function SectionHeading({ title, hint, id, level = 3 }: { title: string; hint?: string; id?: string; level?: 2 | 3 }) {
  const Heading = level === 2 ? 'h2' : 'h3';
  return (
    <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
      <Heading id={id} className="text-sm font-extrabold tracking-[0.08em] text-[var(--ink-soft)] uppercase">
        {title}
      </Heading>
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

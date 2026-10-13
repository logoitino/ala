/**
 * Shell for every page of the read-only Next admin portal: brand, the six equal section tabs,
 * the Analytics and Departments utility links, sign out, the page title, and the shared open
 * primitives (StatCard, Panel, SectionHeading, Badge, BarRow, FlagStatusList). Exports and props
 * stay stable (Panel `level`, shell `presentation`/`heading`), because Trends, Revenue, Analytics,
 * and the product desks import them. The Product sub-nav starts with Overview (`/product`) so one
 * link is always active on every Product page.
 * Report format is the default on every page, by owner decision 2026-10-12 (ADM-01 owner
 * decision 0): the 1680px report width, underline tabs, open panels with dividers instead of
 * cards, and the bold page title. `presentation="standard"` (7xl width, pill tabs) stays only for
 * compatibility. Home supplies its own community hero through `heading={null}`.
 * Contrast (2026-10-12, from the globals.css values): the active underline tab and the active
 * Product link are --jade text and a 2px --jade underline on the white header, 5.97:1 (5.60:1
 * against --canvas), so both clear 4.5:1 for text and 3:1 for the indicator.
 * FlagStatusList wraps long flag names and hints rather than cutting them off (W3-PORTAL), and
 * every heading wrapper is `min-w-0` so long headings wrap inside grids.
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
  { href: '/product', label: 'Overview' },
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

/**
 * One line under the page title, so each page says what it is for. Home passes `heading={null}`
 * (its community hero holds the h1), so `'/'` shows only if Home ever drops that hero; it stays
 * because the shell types every route.
 */
const SUBTITLES: Record<PortalHref, string> = {
  '/': "This week's donations, clips, attention and playback, plus the rates we do not measure.",
  '/reports': 'How the numbers move over the last 7 days.',
  '/audience': 'Who is on the platform: profiles, athletes, schools, and the clip mix.',
  '/money': 'Donations and the ledger, read from the recorded rows.',
  '/operations': 'Time on tabs, taps, what breaks, and which menus are on.',
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
    ? 'flex min-h-10 items-center justify-center gap-2 rounded-xl bg-[var(--surface)] px-1.5 text-center text-sm font-extrabold text-[var(--jade)] shadow-[var(--shadow-card)] ring-1 ring-[var(--border)] sm:px-3'
    : 'flex min-h-10 items-center justify-center gap-2 rounded-xl px-1.5 text-center text-sm font-bold text-[var(--ink-soft)] hover:bg-[var(--surface)]/70 hover:text-[var(--ink)] sm:px-3';
}

function utilityClass(on: boolean) {
  return on
    ? 'inline-flex min-h-10 items-center gap-1.5 rounded-xl bg-[var(--jade-soft)] px-3 text-sm font-extrabold text-[var(--jade)]'
    : 'inline-flex min-h-10 items-center gap-1.5 rounded-xl px-3 text-sm font-bold text-[var(--ink-soft)] hover:bg-[var(--surface-muted)] hover:text-[var(--ink)]';
}

/** Product sub-nav follows the primary report tabs; aria-current and the jade underline name the active desk.
 * On a sub-desk the Product tab says aria-current="true" (current section) and only the desk link says "page". */
function subClass(on: boolean) {
  return on
    ? 'inline-flex min-h-9 items-center justify-center border-b-2 border-[var(--jade)] px-4 text-sm font-extrabold text-[var(--jade)]'
    : 'inline-flex min-h-9 items-center justify-center border-b-2 border-transparent px-4 text-sm font-bold text-[var(--ink-soft)] hover:border-[var(--border)] hover:text-[var(--ink)]';
}

/**
 * @purpose Page frame for the admin portal. Six equal tabs default to Home's report
 *   underline; Product opens a
 *   second row: Overview plus its four desks. Analytics and Departments are utility links, not a seventh
 *   uneven tab. The header scrolls with the page so backward keyboard navigation cannot hide
 *   a focused control behind it, including when Product adds a second navigation row.
 * @param active The current route; drives the title, the subtitle, and every active state.
 * @param heading Replaces the standard kicker + h1 + subtitle block. Omit it for the standard
 *   title. Pass `null` when the page renders its own h1 (Home's community hero); the page must
 *   then supply exactly one h1 before any other heading.
 * @param presentation `'report'` (default, owner decision 2026-10-12): 1680px width, underline
 *   tabs, open report surface (`portal-report`). `'standard'`: the older 7xl width and pill tabs,
 *   kept for compatibility only.
 */
export function PortalShell({ children, active, heading, presentation = 'report' }: {
  children: ReactNode;
  active: PortalHref;
  /** Replaces the standard title block; `null` means the page renders its own h1. */
  heading?: ReactNode;
  /** `'report'` by default (owner decision 2026-10-12); `'standard'` is legacy. */
  presentation?: 'standard' | 'report';
}) {
  const productOpen = TABS[5].match.includes(active);
  const report = presentation === 'report';

  return (
    <div className="min-h-screen bg-[var(--canvas)] text-[var(--ink)]">
      <a
        href="#portal-main"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-xl focus:bg-[var(--surface)] focus:px-4 focus:py-2 focus:text-sm focus:font-extrabold focus:text-[var(--jade)] focus:shadow-lg"
      >
        Skip to content
      </a>
      <header className="border-b border-[var(--border)] bg-[var(--surface)]/95 backdrop-blur">
        <div className={`mx-auto flex w-full flex-wrap items-center gap-x-2 gap-y-3 px-4 py-3 sm:gap-x-4 sm:px-6 ${report ? 'max-w-[1680px] lg:px-10' : 'max-w-7xl'}`}>
          <Link href="/" className="flex min-h-10 shrink-0 items-center gap-2.5 rounded-xl pr-1 sm:pr-2">
            <span aria-hidden="true" className="grid size-9 place-items-center rounded-xl bg-[var(--jade)] text-base font-black text-white shadow-[var(--shadow-card)]">
              T
            </span>
            <span className="leading-tight">
              <span className="block text-sm font-extrabold tracking-tight text-[var(--ink)]">Tapua&apos;i</span>
              <span className="block text-[11px] font-bold tracking-[0.12em] text-[var(--text-muted)] uppercase">Admin · read only</span>
            </span>
          </Link>
          <nav aria-label="Portal" className="order-3 w-full xl:order-none xl:w-auto xl:flex-1">
            <ul className={`gap-1 xl:mx-auto xl:max-w-3xl ${report ? 'flex flex-wrap gap-x-2' : 'grid grid-cols-3 rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)] p-1 sm:grid-cols-6'}`}>
              {TABS.map((tab) => {
                const on = tab.match.includes(active);
                return (
                  <li key={tab.href} className={`min-w-0 ${report ? 'flex-1 basis-[6rem]' : ''}`}>
                    <Link href={tab.href} className={report ? `flex min-h-10 items-center justify-center gap-2 border-b-2 px-1.5 text-sm font-bold sm:px-3 ${on ? 'border-[var(--jade)] text-[var(--jade)]' : 'border-transparent text-[var(--ink-soft)] hover:border-[var(--border)] hover:text-[var(--ink)]'}` : tabClass(on)} aria-current={on ? (tab.href === active ? 'page' : 'true') : undefined}>
                      <span className="hidden 2xl:inline-flex">
                        <Icon d={tab.icon} />
                      </span>
                      {/* No truncate: a tab name is one word and must read whole at 320px and 400% zoom. */}
                      <span>{tab.label}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>
          {/* Phones: brand and Sign out share the first row, Analytics and Departments get their own
              row, then the tabs, so Sign out never wraps alone. From sm up it is one row again. */}
          <div className="order-2 flex w-full min-w-0 flex-wrap items-center gap-1 sm:order-none sm:ml-auto sm:w-auto sm:justify-end">
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
          </div>
          <div className="order-1 ml-auto flex shrink-0 items-center sm:order-none sm:-ml-2">
            <span aria-hidden="true" className="mr-2 hidden h-6 w-px bg-[var(--border)] sm:block" />
            <SignOutButton />
          </div>
        </div>
        {productOpen ? (
          <nav aria-label="Product" className="border-t border-[var(--border)] bg-[var(--surface)]">
            <ul className={`mx-auto flex w-full flex-wrap gap-2 px-4 py-2.5 sm:px-6 ${report ? 'max-w-[1680px] lg:px-10' : 'max-w-7xl'}`}>
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
      <main id="portal-main" tabIndex={-1} className={`mx-auto w-full flex-1 px-4 pt-6 pb-16 outline-none sm:px-6 sm:pt-8 ${report ? 'portal-report max-w-[1680px] lg:px-10' : 'max-w-7xl'}`}>
        {heading !== undefined ? heading : <div className="portal-page-heading mb-8 border-b border-[var(--border)] pb-6">
          <p className="text-[11px] font-extrabold tracking-[0.18em] text-[var(--jade)] uppercase">
            {productOpen && active !== '/product' ? 'Product' : "Tapua'i admin"}
          </p>
          <h1 className="mt-2 text-3xl leading-tight font-black tracking-tight sm:text-4xl">{TITLES[active]}</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--ink-soft)]">{SUBTITLES[active]}</p>
        </div>}
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
      className="portal-stat min-w-0 border-b border-[var(--border)] pb-5"
    >
      <p className="text-[11px] font-extrabold tracking-wide text-[var(--text-muted)] uppercase">{label}</p>
      <p className={`mt-2 text-2xl font-extrabold tracking-tight ${accent}`}>{value}</p>
      <p className="mt-1 text-sm leading-5 text-[var(--ink-soft)]">{hint}</p>
    </div>
  );
}

/**
 * @purpose Open report section with a kicker, heading, optional action, and its content.
 * @param level Heading level, default 2 (unchanged for older pages). Use 3 when the Panel sits
 *   under a section that already has an h2, so the outline does not skip or repeat a level.
 */
export function Panel({
  title,
  children,
  kicker,
  action,
  level = 2,
}: {
  title: string;
  children: ReactNode;
  kicker?: string;
  action?: ReactNode;
  level?: 2 | 3;
}) {
  const Heading = level === 3 ? 'h3' : 'h2';
  return (
    <section
      className="portal-panel min-w-0 border-b border-[var(--border)] py-5"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        {/* min-w-0 + break-words: a long heading wraps inside a grid track instead of widening it. */}
        <div className="min-w-0 max-w-full">
          {kicker ? (
            <p className="text-[11px] font-extrabold tracking-[0.16em] break-words text-[var(--gold)] uppercase">{kicker}</p>
          ) : null}
          <Heading className="mt-1 text-xl font-extrabold tracking-tight break-words">{title}</Heading>
        </div>
        {action ? <div className="min-w-0 max-w-full pt-0.5">{action}</div> : null}
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
    <div className="portal-section-heading mb-5 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
      <Heading id={id} className="min-w-0 text-sm font-extrabold tracking-[0.08em] break-words text-[var(--ink-soft)] uppercase">
        {title}
      </Heading>
      {hint ? <p className="min-w-0 text-xs break-words text-[var(--text-muted)]">{hint}</p> : null}
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
 *   Flag names and hints wrap (`break-words`) instead of truncating, so no words are cut off.
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
                  className="flex min-w-0 items-center justify-between gap-3 border-b border-[var(--border)] py-3"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-bold break-words">{row.label}</p>
                    <p className="text-xs break-words text-[var(--text-muted)]">{row.hint}</p>
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

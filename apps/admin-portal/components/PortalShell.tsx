/**
 * Shell for every page of the read-only Next admin portal: a dark left sidebar (2026-11-04 design refresh from the
 * Lovable reference, replacing the 2026-10-12 top tabs by owner request) with the brand, the six sections, the
 * Product desks nested under Product (Overview, Control map, Features, Profile, Sign-in, People), the Analytics
 * and Departments utility links and Sign out; then the page title and the shared primitives (StatCard, Panel,
 * SectionHeading, Badge, BarRow, FlagStatusList). Exports and props stay stable (Panel `level`, shell
 * `presentation`/`heading`), because Trends, Revenue, Analytics and the product desks import them. Every route,
 * label, subtitle and aria-current rule from the top-tab shell carries over unchanged. Below `lg` the sidebar
 * becomes a top bar whose nav scrolls sideways, so nothing hides behind a menu button and backward keyboard
 * navigation never lands under a fixed header.
 * Contrast: sidebar ink #D5DED9 on #0E1315 is 13.9:1; the active neon #2EE59D is 11.6:1, with a 3px neon bar as
 * the non-text indicator. Main content keeps the light report tokens (jade 5.6:1 on canvas).
 * FlagStatusList wraps long flag names and hints rather than cutting them off (W3-PORTAL), and every heading
 * wrapper is `min-w-0` so long headings wrap inside grids.
 * Owner: PORTAL. The Analytics link is shared with ANALYST.
 * MONEY-TIPS-01 status uses its false catalog default so older rows cannot appear to enable money controls.
 */
import Link from 'next/link';
import type { ReactNode } from 'react';

import { SignOutButton } from '@/components/SignOutButton';
import { APP_RUNTIME_FLAG_GROUPS, readPublishedRuntimeFlag, type AppRuntimeFlagGroup } from '@tapuai/shared-types';

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
  | '/people'
  | '/coverage';

const TABS: { href: PortalHref; label: string; match: PortalHref[]; icon: string }[] = [
  { href: '/', label: 'Home', match: ['/'], icon: 'M3 11.5 12 4l9 7.5M5.5 9.5V20h13V9.5' },
  { href: '/reports', label: 'Trends', match: ['/reports'], icon: 'M3 17l6-6 4 4 8-8M15 7h6v6' },
  { href: '/audience', label: 'Audience', match: ['/audience'], icon: 'M16 19v-1a4 4 0 0 0-8 0v1M12 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm7 8v-1a3 3 0 0 0-2-2.8M17 5.2a3 3 0 0 1 0 5.6' },
  { href: '/money', label: 'Revenue', match: ['/money'], icon: 'M12 3v18M16.5 7.5c0-1.7-2-3-4.5-3s-4.5 1.3-4.5 3 2 2.6 4.5 3 4.5 1.3 4.5 3-2 3-4.5 3-4.5-1.3-4.5-3' },
  { href: '/operations', label: 'Health', match: ['/operations'], icon: 'M3 12h4l3-8 4 16 3-8h4' },
  { href: '/product', label: 'Product', match: ['/product', '/features', '/profile', '/auth', '/people', '/coverage'], icon: 'M4 7l8-4 8 4-8 4-8-4Zm0 5 8 4 8-4M4 17l8 4 8-4' },
];

const PRODUCT_LINKS: { href: PortalHref; label: string }[] = [
  { href: '/product', label: 'Overview' },
  { href: '/coverage', label: 'Control map' },
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
  '/coverage': 'Control map',
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
  '/': "This week's gifts, clips, attention and playback, plus the rates we do not measure.",
  '/reports': 'How the numbers move over the last 7 days.',
  '/audience': 'Who is on the platform: profiles, athletes, schools, and the clip mix.',
  '/money': 'Gifts and the ledger, read from the recorded rows.',
  '/operations': 'Time on tabs, taps, what breaks, and which menus are on.',
  '/manage': 'Billing, Marketing, Support, API, and IT on one read-only page.',
  '/analytics': 'Dashboards and the measure catalog. Every number names its source.',
  '/product': 'Menus, profile, sign-in, people, and the Control map. Changes stay in Expo /admin.',
  '/coverage': 'Fan surfaces and Expo desks that own them. Live control counts stay in Expo /admin/product/coverage.',
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

/** Sidebar row: neon text plus a neon bar for the current page or section; muted ink otherwise. */
function navClass(on: boolean) {
  return on
    ? 'relative flex min-h-11 items-center gap-3 rounded-xl bg-[var(--sidebar-active)] px-3 text-sm font-extrabold text-[var(--sidebar-accent)] before:absolute before:inset-y-2 before:left-0 before:w-[3px] before:rounded-full before:bg-[var(--sidebar-accent)]'
    : 'flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-bold text-[var(--sidebar-ink)] hover:bg-[var(--sidebar-active)] hover:text-white';
}

/** Product desks sit indented under Product; the active desk says aria-current="page". */
function subClass(on: boolean) {
  return on
    ? 'flex min-h-10 items-center rounded-lg pl-10 pr-3 text-sm font-extrabold text-[var(--sidebar-accent)]'
    : 'flex min-h-10 items-center rounded-lg pl-10 pr-3 text-sm font-semibold text-[var(--sidebar-ink-muted)] hover:text-white';
}

const UTILITY_LINKS: { href: PortalHref; label: string; icon: string }[] = [
  { href: '/analytics', label: 'Analytics', icon: 'M4 20V10m6 10V4m6 16v-7m4 7H2' },
  { href: '/manage', label: 'Departments', icon: 'M4 5h7v6H4zM13 5h7v4h-7zM13 11h7v8h-7zM4 13h7v6H4z' },
];

/**
 * @purpose Page frame for the admin portal: dark sidebar navigation (top bar below `lg`) and the light report
 *   surface. Product opens its five desks (Overview first, so one link is always active on every Product page).
 * @param active The current route; drives the title, the subtitle, and every active state.
 * @param heading Replaces the standard kicker + h1 + subtitle block. Omit it for the standard title. Pass `null`
 *   when the page renders its own h1 (Home's community hero); the page must then supply exactly one h1 before any
 *   other heading.
 * @param presentation `'report'` (default): 1440px content width and the open report surface (`portal-report`).
 *   `'standard'`: the older 7xl width, kept for compatibility only.
 */
export function PortalShell({ children, active, heading, presentation = 'report' }: {
  children: ReactNode;
  active: PortalHref;
  /** Replaces the standard title block; `null` means the page renders its own h1. */
  heading?: ReactNode;
  /** `'report'` by default; `'standard'` is legacy. */
  presentation?: 'standard' | 'report';
}) {
  const productOpen = TABS[5].match.includes(active);
  const report = presentation === 'report';

  return (
    <div className="min-h-screen bg-[var(--canvas)] text-[var(--ink)] lg:flex">
      <a
        href="#portal-main"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-xl focus:bg-[var(--surface)] focus:px-4 focus:py-2 focus:text-sm focus:font-extrabold focus:text-[var(--jade)] focus:shadow-lg"
      >
        Skip to content
      </a>
      <aside className="bg-[var(--sidebar-bg)] text-[var(--sidebar-ink)] lg:sticky lg:top-0 lg:flex lg:h-screen lg:w-64 lg:shrink-0 lg:flex-col lg:overflow-y-auto">
        <div className="flex items-center justify-between gap-3 px-4 py-3 lg:px-5 lg:pt-6 lg:pb-5">
          <Link href="/" className="flex min-h-10 items-center gap-2.5 rounded-xl pr-2">
            {/* Tapua'i app icon (static file in public/brand); decorative, the wordmark names the app. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brand/tapuai-app-icon.png" alt="" width={36} height={36} className="size-9 rounded-xl shadow-[0_0_18px_rgba(46,229,157,0.35)]" />
            <span className="leading-tight">
              <span className="block font-[family-name:var(--font-bricolage)] text-lg tracking-tight text-white">Tapua&apos;i</span>
              <span className="block text-[11px] font-bold tracking-[0.12em] text-[var(--sidebar-ink-muted)] uppercase">Admin · read only</span>
            </span>
          </Link>
          <div className="lg:hidden">
            <SignOutButton tone="sidebar" />
          </div>
        </div>
        <nav aria-label="Portal" className="overflow-x-auto px-2 pb-3 lg:flex-1 lg:overflow-visible lg:px-3 lg:pb-0">
          <ul className="flex min-w-max gap-1 lg:min-w-0 lg:flex-col">
            {TABS.map((tab) => {
              const on = tab.match.includes(active);
              const isProduct = tab.href === '/product';
              return (
                <li key={tab.href} className="lg:w-full">
                  <Link href={tab.href} className={navClass(on)} aria-current={on ? (tab.href === active ? 'page' : 'true') : undefined}>
                    <Icon d={tab.icon} />
                    <span>{tab.label}</span>
                  </Link>
                  {isProduct && productOpen ? (
                    <ul aria-label="Product" className="mt-1 hidden flex-col gap-0.5 lg:flex">
                      {PRODUCT_LINKS.map((link) => (
                        <li key={link.href}>
                          <Link href={link.href} className={subClass(link.href === active)} aria-current={link.href === active ? 'page' : undefined}>
                            {link.label}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </li>
              );
            })}
            <li aria-hidden="true" className="mx-2 w-px self-stretch bg-[var(--sidebar-line)] lg:mx-3 lg:my-3 lg:h-px lg:w-auto" />
            {UTILITY_LINKS.map((link) => (
              <li key={link.href} className="lg:w-full">
                <Link href={link.href} className={navClass(active === link.href)} aria-current={active === link.href ? 'page' : undefined}>
                  <Icon d={link.icon} />
                  <span>{link.label}</span>
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        {/* Below lg the Product desks get their own scrolling row under the section nav. */}
        {productOpen ? (
          <nav aria-label="Product desks" className="overflow-x-auto border-t border-[var(--sidebar-line)] px-2 py-2 lg:hidden">
            <ul className="flex min-w-max gap-1">
              {PRODUCT_LINKS.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className={`flex min-h-10 items-center rounded-lg px-3 text-sm ${link.href === active ? 'bg-[var(--sidebar-active)] font-extrabold text-[var(--sidebar-accent)]' : 'font-semibold text-[var(--sidebar-ink)]'}`}
                    aria-current={link.href === active ? 'page' : undefined}
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ) : null}
        <div className="hidden border-t border-[var(--sidebar-line)] p-4 lg:block">
          <SignOutButton tone="sidebar" />
        </div>
      </aside>
      <main id="portal-main" tabIndex={-1} className={`mx-auto w-full min-w-0 flex-1 px-4 pt-6 pb-16 outline-none sm:px-6 sm:pt-8 ${report ? 'portal-report max-w-[1440px] lg:px-10 lg:pt-10' : 'max-w-7xl'}`}>
        {heading !== undefined ? heading : <div className="portal-page-heading mb-8">
          <p className="text-[11px] font-extrabold tracking-[0.18em] text-[var(--jade)] uppercase">
            {productOpen && active !== '/product' ? 'Product' : "Tapua'i admin"}
          </p>
          <h1 className="mt-2 text-3xl leading-tight font-black tracking-tight sm:text-4xl">{TITLES[active]}</h1>
          <p className="mt-2 max-w-3xl text-base leading-7 text-[var(--ink-soft)]">{SUBTITLES[active]}</p>
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
      className="portal-stat min-w-0 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-[var(--shadow-card)]"
    >
      <p className="text-[11px] font-extrabold tracking-wide text-[var(--text-muted)] uppercase">{label}</p>
      <p className={`mt-2 text-3xl font-black tracking-tight tabular-nums ${accent}`}>{value}</p>
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
      className="portal-panel min-w-0 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-[var(--shadow-card)] sm:p-6"
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
              const on = readPublishedRuntimeFlag(published, row);
              return (
                <div
                  key={row.path}
                  className="flex min-w-0 items-center justify-between gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3"
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

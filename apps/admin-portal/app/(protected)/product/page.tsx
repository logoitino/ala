/**
 * Desk links use the shared open report dividers so Product follows Home's format.
 * Product tab (`/product`). A meter of menus switched on per flag group, from the published
 * runtime flags Health already reads, then four equal links into the read-only product desks.
 * Unread flags show "—", never "all on". Switches are changed only in Expo /admin.
 * @sideEffects `app_runtime_config` SELECT (published flags) via `fetchPortalRuntime`.
 */
import type { Metadata } from 'next';
import Link from 'next/link';

import { Meter } from '@/components/charts';
import { PortalShell, SectionHeading } from '@/components/PortalShell';
import { formatCount } from '@/lib/dashboard';
import { menuSplits } from '@/lib/operations';
import { fetchPortalRuntime } from '@/lib/softWall';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Product' };

const LINKS = [
  { href: '/features', title: 'Features', detail: 'Which menus are on. Changes stay in Expo /admin.' },
  { href: '/profile', title: 'Profile', detail: 'What the profile screen is allowed to show.' },
  { href: '/auth', title: 'Sign-in', detail: 'Which actions ask a guest to create an account.' },
  { href: '/people', title: 'People', detail: 'Who has a profile. Granting access stays in Expo /admin.' },
] as const;

/** Desks that stay in Expo. Health probes the ones whose database update can still be missing. */
const EXPO_DESKS = [
  { path: '/admin/sport-quiz', title: 'Trivia', detail: 'Rounds, Life Playbook, and IQ questions. A right answer adds 5 Aura on the phone. If the Aura card does not move, that write failed.' },
  { path: '/admin/fan-zone', title: 'Fan Zone', detail: 'Campaigns, private entries, and free ballots.' },
  { path: '/admin/highlights', title: 'Highlights', detail: 'Beyond contributions, challenge invites, and the coach-level label.' },
  { path: '/admin/support', title: 'Engineering Support', detail: 'Syntax, logic, and glitches. Health counts the open ones. Review stays here.' },
] as const;

/**
 * @purpose Product tab: menus on per group, then the four product desks.
 */
export default async function ProductPage() {
  const runtime = await fetchPortalRuntime();
  const groups = menuSplits(runtime.published, runtime.configured);

  return (
    <PortalShell active="/product">
      <section aria-labelledby="product-menus" className="mb-10">
        <SectionHeading
          id="product-menus"
          level={2}
          title="Menus on"
          hint={runtime.publishedAt ? `Published ${new Date(runtime.publishedAt).toLocaleString('en-US', { timeZone: 'UTC' })} UTC` : 'Published switches'}
        />
        {!runtime.configured ? (
          <p className="mb-3 rounded-xl border border-[var(--gold)]/30 bg-[var(--gold-soft)] px-4 py-3 text-sm font-semibold text-[var(--gold)]">
            The published switches were not read, so on and off are not shown.
          </p>
        ) : runtime.dirty ? (
          <p className="mb-3 rounded-xl border border-[var(--gold)]/30 bg-[var(--gold-soft)] px-4 py-3 text-sm font-semibold text-[var(--gold)]">
            Expo /admin has draft changes that are not published yet. These meters show the published switches.
          </p>
        ) : null}
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {groups.map((group) => (
            <Meter
              key={group.id}
              label={group.title}
              part={group.on}
              whole={group.total}
              format={formatCount}
              hint={group.caption}
              source={`app_runtime_config.published.${group.id}`}
            />
          ))}
        </div>
      </section>

      <section aria-labelledby="product-desks">
        <SectionHeading id="product-desks" level={2} title="Product desks" hint="Read only" />
        <ul className="grid gap-3 sm:grid-cols-2">
          {LINKS.map((item) => (
            <li key={item.href}>
              <Link
                href={item.href}
                className="group flex min-h-28 flex-col justify-between border-b border-[var(--border)] py-5 hover:border-[var(--jade)]"
              >
                <span className="flex items-center justify-between gap-2 text-base font-extrabold">
                  {item.title}
                  <span aria-hidden="true" className="text-[var(--text-muted)] group-hover:text-[var(--jade)]">
                    →
                  </span>
                </span>
                <span className="mt-2 text-sm leading-5 text-[var(--ink-soft)]">{item.detail}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="expo-desks" className="mt-10">
        <SectionHeading id="expo-desks" level={2} title="Expo desks" hint="Not hosted in this portal" />
        <ul className="grid gap-3 sm:grid-cols-2">
          {EXPO_DESKS.map((item) => (
            <li key={item.path} className="border-b border-[var(--border)] py-5">
              <p className="text-base font-extrabold">{item.title}</p>
              <p className="mt-1 text-sm leading-5 text-[var(--ink-soft)]">{item.detail}</p>
              <p className="mt-2 text-sm font-extrabold text-[var(--jade)]">{item.path}</p>
            </li>
          ))}
        </ul>
      </section>
    </PortalShell>
  );
}

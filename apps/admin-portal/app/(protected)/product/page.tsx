import Link from 'next/link';

import { PortalShell, SectionHeading } from '@/components/PortalShell';

export const dynamic = 'force-dynamic';

const LINKS = [
  { href: '/features', title: 'Features', detail: 'Which menus are on. Changes stay in Expo /admin.' },
  { href: '/profile', title: 'Profile', detail: 'What the profile screen is allowed to show.' },
  { href: '/auth', title: 'Sign-in', detail: 'Which actions ask a guest to create an account.' },
  { href: '/people', title: 'People', detail: 'Who has a profile. Granting access stays in Expo /admin.' },
] as const;

/**
 * @purpose Product tab. Four equal links into the read-only product desks.
 */
export default function ProductPage() {
  return (
    <PortalShell active="/product">
      <SectionHeading title="Product" hint="Read only" />
      <div className="grid gap-3 sm:grid-cols-2">
        {LINKS.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="flex min-h-28 flex-col justify-between rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 hover:border-[var(--jade)]"
            style={{ boxShadow: 'var(--shadow-card)' }}
          >
            <p className="text-base font-extrabold">{item.title}</p>
            <p className="mt-2 text-sm leading-5 text-[var(--ink-soft)]">{item.detail}</p>
          </Link>
        ))}
      </div>
    </PortalShell>
  );
}

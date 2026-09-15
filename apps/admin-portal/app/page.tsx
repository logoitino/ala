import type { SpotlightAward, UserRole } from '@tapuai/shared-types';

const DEMO_ROLES: UserRole[] = ['admin', 'operator', 'booster'];

const DEMO_SPOTLIGHT: Pick<SpotlightAward, 'title' | 'headline' | 'school_name'> = {
  title: 'Player of the Week',
  headline: 'Shared types are wired through @tapuai/shared-types.',
  school_name: 'Westlake High',
};

/**
 * @purpose Next.js admin portal landing stub. Production desks still ship in Expo `/admin` until the web port lands.
 */
export default function AdminHomePage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col gap-8 px-6 py-16">
      <p className="text-xs font-extrabold tracking-[0.18em] uppercase text-[var(--gold)]">
        Tapua&apos;i monorepo
      </p>
      <h1 className="text-4xl font-extrabold tracking-tight text-[var(--ink)]">Admin portal scaffold</h1>
      <p className="text-base leading-7 text-slate-600">
        This Next.js App Router app is the future web control plane. The live production desks still run inside
        the Expo mobile package at <code className="rounded bg-white px-1.5 py-0.5">/admin</code> until screens
        are ported here.
      </p>
      <section className="rounded-2xl border border-amber-300 bg-[#fff8dc] p-5 shadow-sm">
        <h2 className="text-sm font-extrabold tracking-wide text-[var(--gold)] uppercase">Shared types check</h2>
        <p className="mt-2 text-sm text-slate-700">
          Roles: {DEMO_ROLES.join(' · ')}
        </p>
        <p className="mt-1 text-sm text-slate-700">
          Spotlight sample: {DEMO_SPOTLIGHT.title} — {DEMO_SPOTLIGHT.headline} ({DEMO_SPOTLIGHT.school_name})
        </p>
      </section>
      <ol className="list-decimal space-y-2 pl-5 text-sm text-slate-700">
        <li>
          Copy <code>.env.example</code> to <code>.env.local</code> and set{' '}
          <code>NEXT_PUBLIC_SUPABASE_*</code>.
        </li>
        <li>
          Run <code>pnpm admin</code> from the repo root.
        </li>
        <li>Keep publishing the Expo admin until this portal owns a desk.</li>
      </ol>
    </main>
  );
}

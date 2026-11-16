/**
 * Product Control map (`/coverage`). Read-only surface directory aligned with Expo
 * `adminCoverage` / `PORTAL_COVERAGE_SURFACES`. Live per-control telemetry stays in
 * Expo `/admin/product/coverage`. This page keeps Next oversight accountable when
 * agents add fan surfaces (web, Fan Zone, quiz, …).
 * @sideEffects None — static shared catalog only.
 */
import type { Metadata } from 'next';
import Link from 'next/link';

import { ExpoDeskPath } from '@/components/ExpoDeskPath';
import { PortalShell, SectionHeading } from '@/components/PortalShell';
import { PORTAL_COVERAGE_SURFACES } from '@tapuai/shared-types/admin/expoDeskDirectory';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Control map' };

/**
 * @purpose Product Control map: every fan surface the portal knows, with the Expo desk that owns repair.
 */
export default function CoveragePage() {
  return (
    <PortalShell active="/coverage">
      <p className="mb-8 max-w-3xl text-sm leading-6 text-[var(--ink-soft)]">
        This portal does not edit flags or measure taps. Open{' '}
        <code className="rounded bg-[var(--jade-soft)] px-1.5">/admin/product/coverage</code> in Expo for live
        control counts, flags, and telemetry. When a feature lands, agents update{' '}
        <code className="rounded bg-[var(--jade-soft)] px-1.5">adminCoverage.ts</code> and{' '}
        <code className="rounded bg-[var(--jade-soft)] px-1.5">expoDeskDirectory.ts</code> in the same turn.
      </p>

      <section aria-labelledby="coverage-surfaces">
        <SectionHeading
          id="coverage-surfaces"
          level={2}
          title="Fan surfaces"
          hint={`${PORTAL_COVERAGE_SURFACES.length} surfaces · read only`}
        />
        <ul className="grid gap-3 sm:grid-cols-2">
          {PORTAL_COVERAGE_SURFACES.map((surface) => (
            <li key={surface.id} className="border-b border-[var(--border)] py-5">
              <p className="text-base font-extrabold">{surface.label}</p>
              <p className="mt-1 text-sm leading-5 text-[var(--ink-soft)]">{surface.hint}</p>
              <ExpoDeskPath path={surface.adminPath} />
            </li>
          ))}
        </ul>
      </section>

      <p className="mt-10 text-sm text-[var(--ink-soft)]">
        Product overview and Expo desk directory:{' '}
        <Link href="/product" className="font-extrabold text-[var(--jade)] underline-offset-2 hover:underline">
          Product
        </Link>
        .
      </p>
    </PortalShell>
  );
}

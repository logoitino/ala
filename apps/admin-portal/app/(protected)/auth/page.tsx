/**
 * Provider rows follow the open report format and wrap labels/redirects at enlarged text.
 * Config keys (flag paths, telemetry ids, provider ids, code names) sit only inside a closed "Keys"
 * disclosure, like the chart kit's Data toggle, so the page itself reads as words (ADM-01 P3, 2026-10-18).
 * Sign-in desk (`/auth`, under Product). Read-only Soft-Wall oversight: which actions ask a guest
 * to create an account, and the sign-in providers. Changes happen only in Expo /admin. Browser tab
 * title "Sign-in · Tapua'i Admin". Section headings under the shell's h1 are h2 and the Panels
 * beneath them are h3, so the outline never skips a level (W3-PORTAL, 2026-10-12).
 * @sideEffects `fetchSoftWallOversight` (read-only).
 */
import type { Metadata } from 'next';
import type { ReactNode } from 'react';

import { Panel, PortalShell, SectionHeading, StatCard } from '@/components/PortalShell';
import { fetchSoftWallOversight } from '@/lib/softWall';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Sign-in' };

/** Closed native disclosure holding config keys; same look as the chart kit's Data toggle. */
function Keys({ title, children }: { title: string; children: ReactNode }) {
  return (
    <details className="chart-disclosure group mt-3 w-full min-w-0">
      <summary className="inline-flex min-h-6 cursor-pointer items-center gap-1.5 rounded-md px-2 py-1 text-xs font-extrabold text-[var(--ink-soft)] select-none hover:bg-[var(--surface-muted)]">
        <svg aria-hidden="true" focusable="false" viewBox="0 0 12 12" className="chart-disclosure-icon size-3">
          <path d="M4.5 2.5 8 6l-3.5 3.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        Keys
        <span className="sr-only"> for {title}</span>
      </summary>
      <dl className="mt-2 grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1 font-mono text-xs text-[var(--text-muted)]">{children}</dl>
    </details>
  );
}

function Key({ label, value }: { label: string; value: string }) {
  return (
    <div className="contents">
      <dt className="font-sans font-bold">{label}</dt>
      <dd className="min-w-0 break-words">{value}</dd>
    </div>
  );
}

/**
 * @purpose Soft-Wall gate + provider oversight for the web control plane.
 * @sideEffects `fetchSoftWallOversight`.
 */
export default async function SoftWallAuthPage() {
  const oversight = await fetchSoftWallOversight();

  return (
    <PortalShell active="/auth">
      {!oversight.configured ? <p role="status" className="mb-4 rounded-xl border border-[var(--gold-soft)] bg-[var(--gold-soft)] px-4 py-3 text-sm font-semibold text-[var(--gold)]">Live sign-in status is unavailable. Check the public Supabase configuration and retry.</p> : null}
      <div className="mb-8 grid gap-4 sm:grid-cols-3">
        <StatCard label="Give Soft Wall" value={!oversight.configured ? 'Unavailable' : oversight.maloLive ? 'Armed' : 'Paused'} hint="Give buttons, Features desk" tone={!oversight.configured ? 'neutral' : oversight.maloLive ? 'ok' : 'warn'} />
        <StatCard label="Crew Soft Wall" value={!oversight.configured ? 'Unavailable' : oversight.crewLive ? 'Armed' : 'Paused'} hint="Crew buttons, Features desk" tone={!oversight.configured ? 'neutral' : oversight.crewLive ? 'ok' : 'warn'} />
        <StatCard
          label="Gear goal Soft Wall"
          value={!oversight.configured ? 'Unavailable' : oversight.wishlistLive ? 'Armed' : 'Paused'}
          hint="Gear goal layout, Features desk"
          tone={!oversight.configured ? 'neutral' : oversight.wishlistLive ? 'ok' : 'warn'}
        />
      </div>

      <Panel title="Zero lost context" kicker="Product lock">
        <p className="text-sm leading-6 text-[var(--ink-soft)]">
          After a guest signs in with Apple, Google or a Magic Link, the app reopens what they were doing: the give
          sheet, the Crew toggle, the gear-goal gift, or Vault Exclusive. Each gate is counted on the Coverage desk in
          Expo. On Expo web the same Soft-Wall resume applies before Stripe.js Exclusive checkout.
        </p>
        <Keys title="Zero lost context">
          <Key label="Code" value="SoftWallModal · SoftWallContext · exclusiveCheckout" />
          <Key label="Telemetry" value={oversight.softWallGates.map((gate) => gate.telemetry).join(' · ')} />
          <Key label="Web surface" value="adminCoverage web.* · portal /coverage" />
        </Keys>
      </Panel>

      <div className="mt-8">
        <SectionHeading level={2} title="Gates" hint={`${oversight.softWallGates.length} configured`} />
        <div className="grid gap-4">
          {oversight.softWallGates.map((gate) => (
            <Panel key={gate.id} level={3} title={gate.label} kicker="Gate">
              <p className="text-sm text-[var(--ink-soft)]">{gate.hint}</p>
              <dl className="grid gap-2 text-sm sm:grid-cols-2">
                <div>
                  <dt className="font-bold text-[var(--text-muted)]">Fan surface</dt>
                  <dd>{gate.fanSurface}</dd>
                </div>
                <div>
                  <dt className="font-bold text-[var(--text-muted)]">Expo desk</dt>
                  <dd>{gate.adminDesk}</dd>
                </div>
              </dl>
              <Keys title={gate.label}>
                <Key label="Gate" value={gate.id} />
                <Key label="Flag" value={gate.flagPath ?? 'Set in code'} />
                <Key label="Telemetry" value={gate.telemetry} />
              </Keys>
            </Panel>
          ))}
        </div>
      </div>

      <div className="mt-8">
        <SectionHeading level={2} title="Providers" />
        <Panel level={3} title="Sign-in providers" kicker="Auth">
          <ul className="grid gap-2 sm:grid-cols-2">
            {oversight.authProviders.map((provider) => (
              <li key={provider.id} className="min-w-0 border-b border-[var(--border)] py-3">
                <p className="min-w-0 font-bold">{provider.label}</p>
                <p className="text-xs text-[var(--text-muted)]">Redirect {provider.redirect}</p>
              </li>
            ))}
          </ul>
          <Keys title="Sign-in providers">
            {oversight.authProviders.map((provider) => (
              <Key key={provider.id} label={provider.label} value={provider.id} />
            ))}
          </Keys>
          <p className="mt-3 text-sm leading-6 text-[var(--ink-soft)]">
            Last Publish to app:{' '}
            {!oversight.configured ? 'Unavailable' : oversight.publishedAt ? new Date(oversight.publishedAt).toLocaleString() : 'Never / unknown'}. Toggle
            Soft-Wall related flags on the Features desk, then Publish.
          </p>
        </Panel>
      </div>
    </PortalShell>
  );
}

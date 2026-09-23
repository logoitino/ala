import { FlagStatusList, Panel, PortalShell } from '@/components/PortalShell';
import { fetchPortalRuntime } from '@/lib/softWall';

export const dynamic = 'force-dynamic';

/**
 * @purpose Read-only Features status. This portal is oversight only — toggling and publishing chrome
 *   happens in Expo `/admin/features` (and `/admin/look` for Profile chrome), which write the same
 *   `app_runtime_config` this page reads. Kept deliberately non-interactive so there is exactly one
 *   place changes are actually made.
 * @sideEffects `fetchPortalRuntime` (read-only).
 */
export default async function FeaturesPage() {
  const runtime = await fetchPortalRuntime();

  return (
    <PortalShell active="/features">
      <Panel title="Features" kicker="Read-only status">
        <p className="text-sm leading-6 text-[var(--ink-soft)]">
          Live chrome fans currently see — fan bar, hype buttons, boards, Soft-Wall-related Mālo / Crew / Wishlist /
          Operator, and Profile chrome. This desk is oversight only; toggle and Publish to app from Expo{' '}
          <code className="rounded bg-[var(--jade-soft)] px-1.5 py-0.5 text-[var(--jade)]">/admin/features</code> or{' '}
          <code className="rounded bg-[var(--jade-soft)] px-1.5 py-0.5 text-[var(--jade)]">/admin/look</code> — same{' '}
          <code className="rounded bg-[var(--jade-soft)] px-1.5 py-0.5 text-[var(--jade)]">app_runtime_config</code>{' '}
          this page reads, so changes show up here immediately after Publish.
        </p>
        {!runtime.configured ? (
          <p className="rounded-xl border border-[var(--gold-soft)] bg-[var(--gold-soft)] px-4 py-3 text-sm font-semibold text-[var(--gold)]">
            Supabase env missing.
          </p>
        ) : (
          <>
            {runtime.dirty ? (
              <p className="rounded-xl border border-[var(--gold-soft)] bg-[var(--gold-soft)] px-4 py-3 text-sm font-semibold text-[var(--gold)]">
                A draft is waiting on Publish to app in Expo — this list shows what fans see live, not the draft.
              </p>
            ) : null}
            <FlagStatusList published={runtime.published} />
          </>
        )}
      </Panel>
      <p className="mt-4 text-sm text-[var(--text-muted)]">
        Need to change something? Open Expo <code className="rounded bg-[var(--jade-soft)] px-1.5">/admin/features</code>.
      </p>
    </PortalShell>
  );
}

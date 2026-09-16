import { FeatureFlagBoard } from '@/components/FeatureFlagBoard';
import { Panel, PortalShell } from '@/components/PortalShell';
import { fetchPortalRuntime } from '@/lib/softWall';

export const dynamic = 'force-dynamic';

/**
 * @purpose Dynamic Features desk on Next — Soft-Wall + Profile chrome + fan bar; draft/publish via Supabase RPCs.
 * @sideEffects `fetchPortalRuntime`; client toggles call patch/publish RPCs.
 */
export default async function FeaturesPage() {
  const runtime = await fetchPortalRuntime();

  return (
    <PortalShell active="/features">
      <Panel title="Features" kicker="Live chrome">
        <p className="text-sm leading-6 text-slate-600">
          Draft the same flags Expo <code className="rounded bg-emerald-50 px-1.5">/admin/features</code> and Look ·
          Profile own: fan bar, hype buttons, boards, Soft-Wall-related Mālo / Crew / Wishlist / Operator, and Profile
          chrome. Publish to app copies draft onto <code className="rounded bg-emerald-50 px-1.5">published</code> so
          Expo fans pick it up over Realtime. Games, Drip, Sports, and catalogs still live only in Expo{' '}
          <code className="rounded bg-emerald-50 px-1.5">/admin</code>.
        </p>
        {!runtime.configured ? (
          <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900">
            Supabase env missing — Features toggles stay disabled until NEXT_PUBLIC_SUPABASE_* is set.
          </p>
        ) : (
          <FeatureFlagBoard
            initialDraft={runtime.draft}
            initialPublished={runtime.published}
            dirty={runtime.dirty}
          />
        )}
      </Panel>
    </PortalShell>
  );
}

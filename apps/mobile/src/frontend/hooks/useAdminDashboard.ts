import { useCallback, useEffect, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';

import { useAuth } from '@/context/AuthContext';
import { isAdminAccess } from '@/lib/roles';
import { assertCurrent, createOfflineActorClient, type OfflineActorClient } from '@/lib/offlineActor';
import { useRoster } from '@/hooks/useRoster';
import {
  defaultSpotlightWindow,
  dismissTelemetryIncident,
  fetchAdminFlags,
  fetchAdminPlatformMetrics,
  fetchAdminSpotlightAwards,
  moderateFlaggedReel,
  publishSpotlightAward,
  type AdminFlagRow,
  type AdminPlatformMetrics,
  type PublishSpotlightInput,
} from '@/lib/admin';
import type { SpotlightAward } from '@/types/database';

/** Which slices a desk actually renders, so Moderation and Spotlight stop refetching each other's data. */
export type AdminDashboardSections = {
  awards?: boolean;
  flags?: boolean;
  metrics?: boolean;
};

const ALL_SECTIONS: Required<AdminDashboardSections> = { awards: true, flags: true, metrics: true };

/**
 * @purpose Web Admin Dashboard data: Spotlight awards, open flags, and platform metrics.
 * @param enabled Opt out of dashboard reads; live data/actions also require this session’s matching real admin profile.
 * @param sections Opt into only the slices this desk shows (defaults to all three for Overview).
 * @returns Flags, metrics, awards, and publish / dismiss / remove actions.
 * @sideEffects `publish_spotlight_award`, `moderate_flagged_reel`, `get_admin_platform_metrics`; `spotlight_awards` / flagged `reels` / `telemetry_logs` SELECTs.
 */
export function useAdminDashboard(enabled = true, sections: AdminDashboardSections = ALL_SECTIONS) {
  const want = { ...ALL_SECTIONS, ...sections };
  const { players, loading: rosterLoading } = useRoster();
  const { session, user, profile, loading: authLoading, isSessionCurrent } = useAuth();
  const ownerId = session?.access_token && user?.id && session.user.id === user.id ? user.id : null;
  // Studio can open the desk frame, but preview roles cannot authorize live admin data or writes.
  const canRead = Boolean(enabled && !authLoading && ownerId && profile?.user_id === ownerId && isAdminAccess({ profile }));
  const identity = useRef({ ownerId, canRead, guard: isSessionCurrent, epoch: 0, mounted: true });
  const flight = useRef<object | null>(null);
  const readRevision = useRef(0);
  if (identity.current.ownerId !== ownerId || identity.current.canRead !== canRead || identity.current.guard !== isSessionCurrent) {
    identity.current = { ...identity.current, ownerId, canRead, guard: isSessionCurrent, epoch: identity.current.epoch + 1 };
    flight.current = null;
    ++readRevision.current;
  }
  const epoch = identity.current.epoch;
  const emptyMetrics: AdminPlatformMetrics = { highlightCount: 0, engagementCount: 0, maloCents: 0, openFlags: 0, telemetryEvents24h: 0 };
  type Snapshot = { epoch: number; awards: SpotlightAward[]; flags: AdminFlagRow[]; metrics: AdminPlatformMetrics; loading: boolean; error: string | null };
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const latest = useRef<Snapshot | null>(null);
  const [busy, setBusy] = useState<{ epoch: number; id: string } | null>(null);
  const isCurrent = useCallback(() => identity.current.mounted && identity.current.epoch === epoch &&
    (isSessionCurrent?.() ?? true), [epoch, isSessionCurrent]);
  const actor = { userId: ownerId ?? '', isCurrent: () => canRead && isCurrent() };
  const adopt = useCallback((next: Snapshot) => {
    if (!isCurrent()) return;
    latest.current = next;
    setSnapshot(next);
  }, [isCurrent]);
  useEffect(() => {
    identity.current.mounted = true;
    return () => { identity.current.mounted = false; flight.current = null; ++readRevision.current; };
  }, []);

  const refresh = useCallback(async () => {
    if (!isCurrent()) return;
    const revision = ++readRevision.current;
    const current = () => isCurrent() && revision === readRevision.current;
    const previous = latest.current?.epoch === epoch ? latest.current : null;
    if (!canRead) {
      adopt({ epoch, awards: [], flags: [], metrics: emptyMetrics, loading: false, error: null });
      return;
    }
    adopt({ epoch, awards: previous?.awards ?? [], flags: previous?.flags ?? [], metrics: previous?.metrics ?? emptyMetrics, loading: true, error: null });
    try {
      const [awards, flags, metrics] = await Promise.all([
        want.awards ? fetchAdminSpotlightAwards() : Promise.resolve([]),
        want.flags ? fetchAdminFlags() : Promise.resolve([]),
        want.metrics ? fetchAdminPlatformMetrics() : Promise.resolve(emptyMetrics),
      ]);
      if (current()) adopt({ epoch, awards, flags, metrics, loading: false, error: null });
    } catch (caught) {
      if (current()) adopt({ epoch, awards: [], flags: [], metrics: emptyMetrics, loading: false,
        error: caught instanceof Error ? caught.message : 'Could not load the admin dashboard.' });
    }
  }, [adopt, canRead, epoch, isCurrent, want.awards, want.flags, want.metrics]);
  useFocusEffect(useCallback(() => { void refresh(); }, [refresh]));

  const run = async <T,>(id: string, work: (client: OfflineActorClient) => Promise<T>): Promise<T> => {
    assertCurrent(actor);
    if (flight.current) throw new Error('An admin action is already in progress. Please wait.');
    const operation = {};
    flight.current = operation;
    setBusy({ epoch, id });
    try {
      const client = await createOfflineActorClient(actor);
      assertCurrent(actor);
      const result = await work(client);
      assertCurrent(actor);
      return result;
    } catch (error) {
      if (isCurrent()) {
        const previous = latest.current?.epoch === epoch ? latest.current : null;
        adopt({ epoch, awards: previous?.awards ?? [], flags: previous?.flags ?? [], metrics: previous?.metrics ?? emptyMetrics,
          loading: previous?.loading ?? false, error: error instanceof Error ? error.message : 'Could not update the admin dashboard.' });
      }
      throw error;
    } finally {
      if (flight.current === operation) {
        flight.current = null;
        if (identity.current.mounted) setBusy(null);
      }
    }
  };
  const publish = async (input: PublishSpotlightInput) => run('publish', async (client) => {
    const award = await publishSpotlightAward(input, client);
    assertCurrent(actor);
    await refresh();
    return award;
  });
  const moderate = async (row: AdminFlagRow, action: 'dismiss' | 'remove') => run(row.id, async (client) => {
    if (row.kind === 'telemetry') {
      const logId = row.id.startsWith('tel:') ? row.id.slice(4) : row.id;
      await dismissTelemetryIncident(logId, client);
    } else await moderateFlaggedReel(row.id, action, client);
    assertCurrent(actor);
    await refresh();
  });
  const current = canRead && isCurrent() && snapshot?.epoch === epoch ? snapshot : null;
  return {
    players: canRead && isCurrent() ? players : [],
    rosterLoading: canRead && isCurrent() ? rosterLoading : false,
    awards: current?.awards ?? [], flags: current?.flags ?? [], metrics: current?.metrics ?? emptyMetrics,
    loading: current?.loading ?? canRead, error: current?.error ?? null,
    busyId: busy?.epoch === epoch && canRead && isCurrent() ? busy.id : null,
    refresh, publish, moderate, defaultWindow: defaultSpotlightWindow,
  };
}

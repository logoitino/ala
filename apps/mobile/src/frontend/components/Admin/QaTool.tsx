import { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';

import {
  AdminBtn,
  AdminDeskLink,
  AdminEmpty,
  AdminMetrics,
  AdminNotice,
  AdminPage,
  AdminPanel,
  AdminRow,
  AdminSectionTitle,
} from '@/components/Admin/AdminChrome';
import { colors } from '@/constants/theme';
import {
  dismissTelemetryIncident,
  fetchAdminTelemetryDigest,
  type AdminTelemetryDigest,
} from '@/lib/admin';
import { fetchAdminOpsInbox, type AdminOpsInbox } from '@/lib/adminCatalog';
import { offlineQueue, type OfflineQueuedAction } from '@/services/OfflineQueue';

const EMPTY_TELEM: AdminTelemetryDigest = {
  stalls: 0,
  reconnects: 0,
  firstFrames: 0,
  checkouts: 0,
  avgCheckoutMs: 0,
  recent: [],
};

const EMPTY_INBOX: AdminOpsInbox = {
  flags: 0,
  pendingVerify: 0,
  pendingTags: 0,
  liveGames: 0,
  parkedGames: 0,
  hiddenDrip: 0,
  lowStock: 0,
  queuedPayouts: 0,
  newFeedback: 0,
  items: [],
};

function queueLabel(row: OfflineQueuedAction): string {
  if (row.type === 'aura_hype') return `Aura ${row.kind} · ${row.reelId.slice(0, 8)}`;
  if (row.type === 'cheer_vote') return `Cheer ${row.side} · ${row.slug}`;
  if (row.type === 'bookmark') return `Save clip · ${row.reelId.slice(0, 8)}`;
  return `Report · ${row.reelId.slice(0, 8)}`;
}

/**
 * @purpose Polish desk: 24h stalls, offline queue, empty production surfaces, copy checklist.
 * @sideEffects `telemetry_logs` SELECT/DELETE; OfflineQueue snapshot / flush / discard; `fetchAdminOpsInbox`.
 */
export function QaTool() {
  const router = useRouter();
  const [telem, setTelem] = useState<AdminTelemetryDigest>(EMPTY_TELEM);
  const [inbox, setInbox] = useState<AdminOpsInbox>(EMPTY_INBOX);
  const [queue, setQueue] = useState<OfflineQueuedAction[]>([]);
  const [online, setOnline] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [nextTelem, nextInbox, nextQueue] = await Promise.all([
        fetchAdminTelemetryDigest(),
        fetchAdminOpsInbox(),
        offlineQueue.snapshot(),
      ]);
      setTelem(nextTelem);
      setInbox(nextInbox);
      setQueue(nextQueue);
      setOnline(offlineQueue.getIsConnected());
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not load QA.');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );

  const flushQueue = async () => {
    setBusy(true);
    setMessage(null);
    try {
      await offlineQueue.flush();
      setQueue(await offlineQueue.snapshot());
      setMessage('Offline queue flushed.');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not flush the queue.');
    } finally {
      setBusy(false);
    }
  };

  const discardQueue = async () => {
    setBusy(true);
    setMessage(null);
    try {
      await offlineQueue.discardAll();
      setQueue([]);
      setMessage('Offline queue cleared on this device.');
    } finally {
      setBusy(false);
    }
  };

  const checks = [
    {
      ok: inbox.liveGames > 0,
      label: inbox.liveGames > 0 ? `${inbox.liveGames} live match${inbox.liveGames === 1 ? '' : 'es'} on Local` : 'Local board is empty',
      href: '/admin/publish' as const,
    },
    {
      ok: inbox.flags === 0,
      label: inbox.flags === 0 ? 'No open Highlight flags' : `${inbox.flags} open flags`,
      href: '/admin/moderation' as const,
    },
    {
      ok: inbox.lowStock === 0,
      label: inbox.lowStock === 0 ? 'Drip stock looks healthy' : `${inbox.lowStock} SKUs under 8 units`,
      href: '/admin/drip' as const,
    },
    {
      ok: inbox.queuedPayouts === 0,
      label: inbox.queuedPayouts === 0 ? 'No queued payouts' : `${inbox.queuedPayouts} disbursements waiting`,
      href: '/admin/money' as const,
    },
    {
      ok: telem.stalls === 0,
      label: telem.stalls === 0 ? 'No Highlight stalls in 24h' : `${telem.stalls} video stalls in 24h`,
      href: '/admin/qa' as const,
    },
  ];

  return (
    <AdminPage
      title="QA"
      lede="Polish what fans feel: stalls, empty Local, low Drip, stuck offline taps. Then open the surface and walk it."
      refreshing={loading}
      onRefresh={() => void refresh()}
      error={error}
    >
      <AdminMetrics
        items={[
          { label: 'Stalls 24h', value: telem.stalls },
          { label: 'Reconnects', value: telem.reconnects },
          { label: 'Donate ms', value: telem.avgCheckoutMs || '—' },
          { label: 'Offline', value: queue.length },
        ]}
      />

      <AdminSectionTitle>Production health</AdminSectionTitle>
      {checks.map((item) => (
        <AdminRow key={item.label} title={item.label} meta={item.ok ? 'Ready' : 'Needs a pass'}>
          {item.ok ? null : <AdminBtn label="Fix" kind="primary" onPress={() => router.push(item.href)} />}
        </AdminRow>
      ))}

      <AdminPanel title="Offline queue">
        <Text style={styles.body}>
          {online === false ? 'This device looks offline.' : 'This device looks online.'} Aura, cheer, save, and report
          tap replay from here when the network comes back.
        </Text>
        {queue.length === 0 ? (
          <AdminEmpty text="Nothing queued on this device." />
        ) : (
          queue.map((row) => <AdminRow key={row.id} title={queueLabel(row)} meta={row.created_at} />)
        )}
        <AdminBtn label={busy ? 'Working…' : 'Flush now'} kind="primary" disabled={busy || queue.length === 0} onPress={() => void flushQueue()} />
        <AdminBtn label="Discard queue" kind="danger" disabled={busy || queue.length === 0} onPress={() => void discardQueue()} />
        <AdminNotice text={message} />
      </AdminPanel>

      <AdminSectionTitle>Walk production</AdminSectionTitle>
      <AdminDeskLink
        title="Open a fan surface as a role"
        meta="Studio owns role preview for Home, Local, Drip, Spotlight, operator, and the HQs"
        href="/admin/studio"
        label="Studio"
      />

      <AdminPanel title="Copy checklist">
        <Text style={styles.body}>Home / Local / Profile say Donate, Seki, and Highlights ⚡ — never the retired money words or like / Reels in the UI (docs/product/VOICE.md, pnpm copy:check).</Text>
        <Text style={styles.body}>Fan bar is Home · Local · + · Spotlight · Drip · Profile. No Dev role chips. No extra Admin tab.</Text>
        <Text style={styles.body}>Operator PIN and scorekeeper stay on `/operator`. Publish scores from Live games or the operator console.</Text>
      </AdminPanel>

      <AdminSectionTitle>Telemetry (24h)</AdminSectionTitle>
      {telem.recent.length === 0 ? (
        <AdminEmpty text="No client events in the last day." />
      ) : (
        telem.recent.slice(0, 24).map((row) => (
          <AdminRow
            key={row.id}
            title={row.title}
            meta={[row.subtitle, row.durationMs != null ? `${row.durationMs} ms` : '', row.createdAt.replace('T', ' ').slice(0, 16)]
              .filter(Boolean)
              .join(' · ')}
          >
            <AdminBtn
              label="Dismiss"
              onPress={() => {
                void dismissTelemetryIncident(row.id).then(() => refresh());
              }}
            />
          </AdminRow>
        ))
      )}
    </AdminPage>
  );
}

const styles = StyleSheet.create({
  body: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18,
  },
});

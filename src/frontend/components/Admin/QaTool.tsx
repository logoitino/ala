import { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { type Href, useFocusEffect, useRouter } from 'expo-router';

import {
  AdminBtn,
  AdminEmpty,
  AdminNotice,
  AdminPage,
  AdminPanel,
  AdminRow,
} from '@/components/Admin/AdminChrome';
import { colors, radii } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import {
  ADMIN_PRODUCTION_SURFACES,
  dismissTelemetryIncident,
  fetchAdminTelemetryDigest,
  type AdminTelemetryDigest,
} from '@/lib/admin';
import { fetchAdminOpsInbox, type AdminOpsInbox } from '@/lib/adminCatalog';
import { offlineQueue, type OfflineQueuedAction } from '@/services/OfflineQueue';
import { FOCAL } from '@/theme/motion';

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
  const { previewAsRole } = useAuth();
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
      <View style={styles.metrics}>
        <View style={styles.metric}>
          <Text style={styles.metricValue}>{telem.stalls}</Text>
          <Text style={styles.metricLabel}>Stalls 24h</Text>
        </View>
        <View style={styles.metric}>
          <Text style={styles.metricValue}>{telem.reconnects}</Text>
          <Text style={styles.metricLabel}>Reconnects</Text>
        </View>
        <View style={styles.metric}>
          <Text style={styles.metricValue}>{telem.avgCheckoutMs || '—'}</Text>
          <Text style={styles.metricLabel}>Mālo ms</Text>
        </View>
        <View style={styles.metric}>
          <Text style={styles.metricValue}>{queue.length}</Text>
          <Text style={styles.metricLabel}>Offline</Text>
        </View>
      </View>

      <Text style={styles.section}>Production health</Text>
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

      <Text style={styles.section}>Walk production</Text>
      {ADMIN_PRODUCTION_SURFACES.map((item) => (
        <AdminRow key={item.href} title={item.label} meta={item.hint}>
          <AdminBtn
            label="Open"
            kind="primary"
            onPress={() => {
              if (item.href === '/operator') {
                void previewAsRole('operator');
                return;
              }
              if (item.href === '/parent') {
                void previewAsRole('parent');
                return;
              }
              if (item.href === '/booster') {
                void previewAsRole('booster');
                return;
              }
              if (item.href === '/sponsor') {
                void previewAsRole('sponsor');
                return;
              }
              router.push(item.href as Href);
            }}
          />
        </AdminRow>
      ))}

      <AdminPanel title="Copy checklist">
        <Text style={styles.body}>Home / Local / Profile still say Mālo, Seki, and Highlights ⚡ — never tip / like / Reels in the UI.</Text>
        <Text style={styles.body}>Fan bar is Home · Local · + · Spotlight · Drip · Profile. No Dev role chips. No extra Admin tab.</Text>
        <Text style={styles.body}>Operator PIN and scorekeeper stay on `/operator`. Publish scores from Live games or the operator console.</Text>
      </AdminPanel>

      <Text style={styles.section}>Telemetry (24h)</Text>
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
  metrics: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  metric: {
    flexGrow: 1,
    minWidth: 88,
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
    gap: 4,
  },
  metricValue: {
    color: FOCAL.neonJade,
    fontSize: 28,
    fontWeight: '800',
  },
  metricLabel: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  section: {
    color: FOCAL.neonJade,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginTop: 4,
  },
  body: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18,
  },
});

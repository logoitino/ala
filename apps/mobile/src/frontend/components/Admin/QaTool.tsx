/** Device-local repair tools keep independent sources readable and expose sampled telemetry delivery/loss. */
import { useCallback, useRef, useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import { useFocusEffect } from 'expo-router';

import {
  AdminBtn,
  AdminDeskLink,
  AdminEmpty,
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
import { offlineQueue, type OfflineQueuedAction } from '@/services/OfflineQueue';
import { telemetry, type TelemetryHealthSnapshot } from '@/services/TelemetryManager';

const READ_TIMEOUT_MS = 10_000;
const deliveryText: Record<TelemetryHealthSnapshot['phase'], string> = {
  unknown: 'No delivery has been confirmed in this session.',
  sending: 'A telemetry batch is being sent.',
  delivered: 'The latest telemetry batch was confirmed.',
  not_configured: 'Telemetry is not configured on this device.',
  migration_missing: 'Telemetry storage is not available.',
  permission_denied: 'Telemetry delivery was denied.',
  delivery_failed: 'Telemetry delivery failed.',
  delivery_uncertain: 'The latest telemetry write could not be confirmed.',
  disposed: 'The telemetry logger is stopped.',
};
const failureText: Record<NonNullable<TelemetryHealthSnapshot['lastFailure']>, string> = {
  not_configured: 'Delivery is not configured', migration_missing: 'Telemetry storage is unavailable',
  permission_denied: 'Delivery was denied', delivery_failed: 'Delivery failed',
  transport_error: 'Write outcome was uncertain', timeout: 'Delivery timed out',
  queue_full: 'The event buffer was full', disposed: 'The logger was stopped',
};
type ReadSource = 'telemetry' | 'queue';
type ReadSlot = { pending: boolean };
const readBag = globalThis as typeof globalThis & { __tapuaiQaReadSlots?: Record<ReadSource, ReadSlot> };
// Reserve actual reads across focus, remount and development reloads; no response data is cached here.
const readSlots = readBag.__tapuaiQaReadSlots ??= { telemetry: { pending: false }, queue: { pending: false } };

/** A stalled source cannot leave refresh permanently busy; later responses are rejected by its generation. */
async function readWithTimeout<T>(read: () => Promise<T>, message: string, source: ReadSource): Promise<T> {
  const slot = readSlots[source];
  if (slot.pending) throw new Error(`A previous ${source === 'telemetry' ? 'client event' : 'device queue'} read is still pending. Refresh once it finishes.`);
  slot.pending = true;
  // Timeout releases the caller, not the underlying read. Never accumulate stalled work or
  // reuse a previous actor's response in another refresh; that caller's generation owns it.
  const work = Promise.resolve().then(read).finally(() => { slot.pending = false; });
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      work,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error(message)), READ_TIMEOUT_MS);
        (timer as unknown as { unref?: () => void }).unref?.();
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

// A development hot reload can retain the older singleton until a full app reload.
const sampleDelivery = () => ({
  value: typeof telemetry.getHealth === 'function' ? telemetry.getHealth() : null,
  sampledAt: new Date().toISOString(),
});

function queueLabel(row: OfflineQueuedAction): string {
  if (row.type === 'aura_hype') return `Aura ${row.kind} · ${row.reelId.slice(0, 8)}`;
  if (row.type === 'hype_clear') return `Clear ${row.kind} · ${row.reelId.slice(0, 8)}`;
  if (row.type === 'cheer_vote') return `Cheer ${row.side} · ${row.slug}`;
  if (row.type === 'bookmark') return `${row.saved ? 'Save' : 'Unsave'} clip · ${row.reelId.slice(0, 8)}`;
  return `Report · ${row.reelId.slice(0, 8)}`;
}

/**
 * @purpose Repair tools: device-local queued taps and bounded telemetry incident actions; analysis belongs to Health.
 * @sideEffects `telemetry_logs` SELECT/DELETE; OfflineQueue snapshot / flush / discard; local health snapshot.
 */
export function QaTool() {
  const [telem, setTelem] = useState<AdminTelemetryDigest | null>(null);
  const [queue, setQueue] = useState<OfflineQueuedAction[]>([]);
  const [queueRead, setQueueRead] = useState(false);
  const [queueLoading, setQueueLoading] = useState(true);
  const [telemLoading, setTelemLoading] = useState(true);
  const [queueError, setQueueError] = useState<string | null>(null);
  const [telemError, setTelemError] = useState<string | null>(null);
  const [delivery, setDelivery] = useState(sampleDelivery);
  const [incidentBusy, setIncidentBusy] = useState<string | null>(null);
  const [online, setOnline] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const active = useRef(false);
  const generation = useRef(0);
  const queueAction = useRef(false);
  const incidentAction = useRef<string | null>(null);

  const current = useCallback((run: number) => active.current && generation.current === run, []);

  const refresh = useCallback(async () => {
    if (!active.current) return;
    const run = ++generation.current;
    setLoading(true);
    setError(null); setMessage(null); setTelem(null); setQueue([]); setQueueRead(false);
    setQueueLoading(true); setTelemLoading(true); setQueueError(null); setTelemError(null);
    setOnline(offlineQueue.getIsConnected()); setDelivery(sampleDelivery());
    // Commit each result when it arrives: an unavailable server must not hide readable device state.
    await Promise.allSettled([
      readWithTimeout(fetchAdminTelemetryDigest, 'Client events could not be read within 10 seconds.', 'telemetry')
        .then(next => { if (current(run)) { setTelem(next); setTelemError(next.error ?? null); } })
        .catch(caught => { if (current(run)) setTelemError(caught instanceof Error ? caught.message : 'Could not read client events.'); })
        .finally(() => { if (current(run)) setTelemLoading(false); }),
      readWithTimeout(() => offlineQueue.snapshot(), 'The device queue could not be read within 10 seconds.', 'queue')
        .then(next => { if (current(run)) { setQueue(next); setQueueRead(true); } })
        .catch(caught => { if (current(run)) setQueueError(caught instanceof Error ? caught.message : 'Could not read the device queue.'); })
        .finally(() => { if (current(run)) setQueueLoading(false); }),
    ]);
    if (current(run)) setLoading(false);
  }, [current]);

  useFocusEffect(
    useCallback(() => {
      active.current = true;
      void refresh();
      return () => { active.current = false; generation.current++; };
    }, [refresh]),
  );

  const flushQueue = async () => {
    if (queueAction.current || !queueRead || !queue.length) return;
    queueAction.current = true;
    const run = generation.current;
    setBusy(true);
    setMessage(null);
    try {
      await offlineQueue.flush();
      if (!current(run)) return;
      const next = await readWithTimeout(() => offlineQueue.snapshot(), 'The device queue could not be read after replay.', 'queue');
      if (!current(run)) return;
      setQueue(next); setOnline(offlineQueue.getIsConnected()); setDelivery(sampleDelivery());
      setMessage(`Replay checked: ${next.length} ${next.length === 1 ? 'action remains' : 'actions remain'} on this device.`);
    } catch (caught) {
      if (current(run)) setError(caught instanceof Error ? caught.message : 'Could not check queue replay.');
    } finally {
      queueAction.current = false;
      if (active.current) setBusy(false);
    }
  };

  const discardQueue = async () => {
    if (queueAction.current || !queueRead || !queue.length) return;
    queueAction.current = true;
    const run = generation.current;
    setBusy(true);
    setMessage(null);
    try {
      await offlineQueue.discardAll();
      if (!current(run)) return;
      setQueue([]);
      setMessage('Offline queue cleared on this device.');
    } catch (caught) { if (current(run)) setError(caught instanceof Error ? caught.message : 'Could not discard the queue.'); } finally {
      queueAction.current = false;
      if (active.current) setBusy(false);
    }
  };

  return (
    <AdminPage
      title="QA"
      lede="Repair client incidents and queued actions on this device. Health owns the complete operational assessment."
      refreshing={loading}
      onRefresh={() => void refresh()}
      error={error}
    >
      <AdminPanel title="Telemetry delivery · this device">
        {!delivery.value ? <AdminEmpty text="Reload the app to load telemetry delivery monitoring." /> : <>
        <Text style={styles.body}>{deliveryText[delivery.value.phase]}</Text>
        <Text style={styles.body}>Sampled on refresh at {delivery.sampledAt.replace('T', ' ').slice(0, 19)} UTC. These counters describe this process, not every user's device.</Text>
        <AdminRow title="Buffered events" meta={`${delivery.value.queued} queued · ${delivery.value.inFlight} pending transport · ${delivery.value.capacity} event limit`} />
        <AdminRow title="Confirmed events" meta={String(delivery.value.delivered)} />
        <AdminRow title="Discarded or unconfirmed events" meta={`${delivery.value.dropped} total · ${delivery.value.uncertain} uncertain`} />
        <Text style={styles.body}>Uncertain writes are included in the discarded count and are not replayed. A pending transport may already be counted as uncertain.</Text>
        {delivery.value.lastDeliveredAt && <AdminRow title="Last confirmed delivery" meta={`${delivery.value.lastDeliveredAt.replace('T', ' ').slice(0, 19)} UTC`} />}
        {delivery.value.lastFailure && <AdminRow title="Last recorded delivery issue" meta={`${failureText[delivery.value.lastFailure]}${delivery.value.lastFailureAt ? ` · ${delivery.value.lastFailureAt.replace('T', ' ').slice(0, 19)} UTC` : ''}`} />}
        </>}
      </AdminPanel>

      <AdminPanel title="Offline queue">
        <Text style={styles.body}>
          {online == null ? 'Connection status is not known.' : online === false ? 'This device looks offline.' : 'This device looks online.'} Aura, cheer, save, and report
          tap replay from here when the network comes back.
        </Text>
        <AdminNotice text={queueError} tone="danger" />
        {busy && <AdminNotice text="A queue action is pending. Its result has not been confirmed; it will not be repeated from this desk." tone="warn" />}
        {!queueRead ? <AdminEmpty text={queueLoading ? "Reading this device’s queue…" : "The device queue could not be read."} /> : queue.length === 0 ? (
          <AdminEmpty text="Nothing queued on this device." />
        ) : (
          queue.map((row) => <AdminRow key={row.id} title={queueLabel(row)} meta={row.created_at} />)
        )}
        <AdminBtn label={busy ? 'Working…' : 'Flush now'} kind="primary" disabled={busy || !queueRead || queue.length === 0} onPress={() => void flushQueue()} />
        <AdminBtn label="Discard queue" kind="danger" disabled={busy || !queueRead || queue.length === 0} onPress={() => void discardQueue()} />
        <AdminNotice text={message} />
      </AdminPanel>

      <AdminSectionTitle>Walk production</AdminSectionTitle>
      <AdminDeskLink
        title="Open a fan surface as a role"
        meta="Studio owns role preview for Home, Local, Drip, Spotlight, operator, and the HQs"
        href="/admin/studio"
        label="Studio"
      />

      <AdminSectionTitle>Recent telemetry · 24h</AdminSectionTitle>
      <Text style={styles.body}>Showing the newest 24 of up to 80 client events read. Period-wide counts and thresholds are in Health.</Text>
      <AdminNotice text={telemError} tone="danger" />
      {incidentBusy && <AdminNotice text="Incident dismissal is pending. Its result has not been confirmed." tone="warn" />}
      {!telem || telemError ? <AdminEmpty text={telemLoading ? "Reading client events…" : "Client events are not in this read."} /> : telem.recent.length === 0 ? (
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
              label={incidentBusy === row.id ? 'Dismissing…' : 'Dismiss'}
              disabled={incidentBusy != null}
              onPress={() => {
                if (incidentAction.current != null) return;
                const run = generation.current;
                incidentAction.current = row.id;
                setIncidentBusy(row.id);
                void dismissTelemetryIncident(row.id)
                  .then(() => { if (current(run)) return refresh(); })
                  .catch(caught => { if (current(run)) setError(caught instanceof Error ? caught.message : 'Could not dismiss incident.'); })
                  .finally(() => { incidentAction.current = null; if (active.current) setIncidentBusy(null); });
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

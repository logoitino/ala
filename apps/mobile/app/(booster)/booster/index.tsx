/**
 * Booster HQ: bulk-add a roster by pasting CSV (name, jersey_number, position, school_name) and set an
 * athlete's verification status. `parseRosterCsv` is deliberately forgiving: it skips a header row and blank lines.
 * Reads and awaited/retained actions use the initiating Auth lifetime; an outgoing HQ cannot alert or refetch for B.
 * @sideEffects Inserts players; updates verification status; telemetry `booster_csv` / `booster_verify`.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { HapticPressable as Pressable } from '@/components/UI/HapticPressable';
import { Stack } from 'expo-router';

import { DashboardPanel } from '@/components/DashboardPanel';
import { ScreenHeading } from '@/components/ScreenHeading';
import { FOCAL } from '@/theme/motion';
import { FamilyFunDiscovery } from '@/components/FamilyFun/FamilyFunDiscovery';
import { ScreenShell } from '@/components/ScreenShell';
import { EmptyState } from '@/components/UI/EmptyState';
import { colors, KIT, radii } from '@/constants/theme';
import { useAppRuntime } from '@/context/AppRuntimeContext';
import { useAuth } from '@/context/AuthContext';
import { assertCurrent, createOfflineActorClient } from '@/lib/offlineActor';
import { offlineQueue } from '@/services/OfflineQueue';
import { telemetry } from '@/services/TelemetryManager';
import { displayValue } from '@/data/players';
import { useRoster } from '@/hooks/useRoster';
import {
  fetchBoosterVerificationQueue,
  insertBoosterRoster,
  setBoosterVerification,
  updateBoosterJersey,
} from '@/lib/boosterPortal';
import type { VerificationRequest } from '@/types/database';

function parseRosterCsv(raw: string) {
  const lines = raw.trim().split(/\r?\n/).filter(Boolean);
  if (lines.length === 0) return [];
  const start = lines[0].toLowerCase().includes('name') ? 1 : 0;
  return lines.slice(start).flatMap((line) => {
    const [name, jersey, position, school_name] = line.split(',').map((part) => part.trim());
    if (!name) return [];
    return [
      {
        name,
        jersey_number: Number(jersey) || 0,
        position: position || 'ATH',
        school_name: school_name || '',
        height: '',
        backer_count: 0,
      },
    ];
  });
}

export default function BoosterHomeScreen() {
  const { live } = useAppRuntime();
  const { user, isSessionCurrent } = useAuth();
  const owner = user?.id ?? null;
  const lifetime = useRef({ owner, guard: isSessionCurrent, active: false, read: 0, busy: false });
  if (lifetime.current.owner !== owner || lifetime.current.guard !== isSessionCurrent) lifetime.current = { owner, guard: isSessionCurrent, active: false, read: 0, busy: false };
  const scope = lifetime.current;
  const current = useCallback(() => lifetime.current === scope && scope.active && (scope.guard?.() ?? true), [scope]);
  useEffect(() => { scope.active = true; return () => { scope.active = false; ++scope.read; }; }, [scope]);
  const { players, loading: rosterLoading, error: rosterError, refresh, setPlayers } = useRoster();
  const [csv, setCsv] = useState('name,jersey_number,position,school_name\nJane Doe,12,WR,Westlake High');
  const [queue, setQueue] = useState<VerificationRequest[]>([]);
  const [queueLoading, setQueueLoading] = useState(true);
  const [queueError, setQueueError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const loadQueue = useCallback(async () => {
    if (!current()) return;
    const revision = ++scope.read;
    const actor = owner ? offlineQueue.captureActor(owner) : null;
    if (!actor) { setQueue([]); setQueueError(null); setQueueLoading(false); return; }
    const accepted = () => current() && actor.isCurrent() && revision === scope.read;
    setQueueLoading(true);
    setQueueError(null);
    try {
      const client = await createOfflineActorClient(actor);
      if (!accepted()) return;
      assertCurrent(actor);
      const result = await fetchBoosterVerificationQueue(client);
      if (!accepted()) return;
      setQueue(result.rows); setQueueError(result.error);
    } catch {
      if (accepted()) { setQueue([]); setQueueError('Could not load verification requests. Try again.'); }
    } finally { if (accepted()) setQueueLoading(false); }
  }, [current, owner, scope]);

  useEffect(() => {
    void loadQueue();
  }, [loadQueue]);

  const uploadCsv = async () => {
    if (!current() || scope.busy || !owner) return;
    const actor = offlineQueue.captureActor(owner);
    if (!actor) return;
    const accepted = () => current() && actor.isCurrent();
    const rows = parseRosterCsv(csv);
    if (rows.length === 0) {
      Alert.alert('CSV empty', 'Add at least one player row.');
      return;
    }
    scope.busy = true; setBusy(true);
    try {
      const client = await createOfflineActorClient(actor);
      if (!accepted()) return;
      assertCurrent(actor);
      telemetry.trackFeature('booster_csv', 'booster');
      const result = await insertBoosterRoster(rows, client);
      if (!accepted()) return;
      if (!result.ok) {
        Alert.alert('Upload failed', result.message);
        return;
      }
      Alert.alert('Roster updated', `Inserted ${rows.length} player${rows.length === 1 ? '' : 's'}.`);
      void refresh();
    } catch {
      if (accepted()) Alert.alert('Upload failed', 'Could not save the roster. Refresh before trying again.');
    } finally {
      scope.busy = false;
      if (accepted()) setBusy(false);
    }
  };

  const updateJersey = async (playerId: string, jersey: string) => {
    if (!current() || !owner) return;
    const actor = offlineQueue.captureActor(owner);
    if (!actor) return;
    const accepted = () => current() && actor.isCurrent();
    const jersey_number = Number(jersey);
    if (!Number.isInteger(jersey_number)) return;
    try {
      const client = await createOfflineActorClient(actor);
      if (!accepted()) return;
      assertCurrent(actor);
      const result = await updateBoosterJersey(playerId, jersey_number, client);
      if (!accepted()) return;
      if (!result.ok) { Alert.alert('Jersey update failed', result.message); return; }
      setPlayers((rows) => accepted() ? rows.map((player) => (player.id === playerId ? { ...player, jersey_number } : player)) : rows);
    } catch {
      if (accepted()) Alert.alert('Jersey update failed', 'Could not save the jersey number.');
    }
  };

  const verify = async (id: string, status: string) => {
    if (!current() || scope.busy || !owner) return;
    const actor = offlineQueue.captureActor(owner);
    if (!actor) return;
    const accepted = () => current() && actor.isCurrent();
    scope.busy = true; setBusy(true); ++scope.read;
    try {
      const client = await createOfflineActorClient(actor);
      if (!accepted()) return;
      assertCurrent(actor);
      telemetry.trackFeature('booster_verify', 'booster');
      const result = await setBoosterVerification(id, status, client);
      if (!accepted()) return;
      if (!result.ok) {
        Alert.alert('Verification failed', result.message);
        return;
      }
      ++scope.read;
      setQueue((rows) => accepted() ? rows.map((item) => (item.id === id ? { ...item, status } : item)) : rows);
    } catch {
      if (accepted()) Alert.alert('Verification failed', 'Could not save verification.');
    } finally {
      scope.busy = false;
      if (accepted()) { setBusy(false); setQueueLoading(false); }
    }
  };

  return (
    <ScreenShell>
      <Stack.Screen options={{ title: 'Booster' }} />
      <ScrollView contentContainerStyle={styles.content}>
        <ScreenHeading
          kicker="Tapua'i booster"
          title="Booster Tools"
          lede={live.copy.boosterLede}
          accent={FOCAL.jadeInk}
        />
        <FamilyFunDiscovery />
        <DashboardPanel title="CSV bulk roster upload" body="Columns: name, jersey_number, position, school_name">
          <TextInput
            value={csv}
            onChangeText={setCsv}
            multiline
            textAlignVertical="top"
            style={styles.csv}
          />
          <Pressable
            accessibilityRole="button"
            disabled={busy}
            onPress={() => void uploadCsv()}
            style={[styles.primary, busy && { opacity: 0.5 }]}
          >
            <Text style={styles.primaryLabel}>Upload roster</Text>
          </Pressable>
        </DashboardPanel>
        <DashboardPanel title="Jersey number updates">
          {rosterError ? (
            <EmptyState
              kicker="Roster"
              title="Could not load athletes"
              lede="Check your connection and try again."
              actionLabel="Retry"
              onAction={() => void refresh()}
            />
          ) : !rosterLoading ? players.map((player) => (
            <View key={player.id} style={styles.row}>
              <Text style={styles.name}>{displayValue(player.name)}</Text>
              <TextInput
                keyboardType="number-pad"
                defaultValue={String(player.jersey_number)}
                onEndEditing={(event) => void updateJersey(player.id, event.nativeEvent.text)}
                style={styles.jersey}
              />
            </View>
          )) : null}
        </DashboardPanel>
        <DashboardPanel title="Profile verification queue">
          {queueError ? (
            <EmptyState
              kicker="Verification"
              title="Could not load the queue"
              lede={queueError}
              actionLabel="Retry"
              onAction={() => void loadQueue()}
            />
          ) : !queueLoading && queue.length === 0 ? (
            <Text style={styles.muted}>No pending verification requests.</Text>
          ) : !queueLoading ? (
            queue.map((item) => (
              <View key={item.id} style={styles.row}>
                <Text style={styles.name}>
                  {item.full_name} · {item.status}
                </Text>
                <Pressable
                  accessibilityRole="button"
                  disabled={busy}
                  onPress={() => void verify(item.id, 'verified')}
                >
                  <Text style={styles.link}>Verify</Text>
                </Pressable>
              </View>
            ))
          ) : null}
        </DashboardPanel>
      </ScrollView>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: 16,
    gap: 14,
  },
  csv: {
    minHeight: 120,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: KIT.controlRadius,
    padding: 12,
    fontSize: 14,
    color: colors.text,
    backgroundColor: colors.background,
  },
  primary: {
    backgroundColor: colors.primary,
    borderRadius: KIT.controlRadius,
    minHeight: 52,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    ...KIT.shadowSoft,
  },
  primaryLabel: {
    color: colors.onAccent,
    fontWeight: '800',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  name: {
    flex: 1,
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
  },
  jersey: {
    width: 64,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingHorizontal: 8,
    paddingVertical: 8,
    textAlign: 'center',
    color: colors.text,
  },
  muted: {
    color: colors.textMuted,
  },
  link: {
    color: colors.primary,
    fontWeight: '800',
  },
});

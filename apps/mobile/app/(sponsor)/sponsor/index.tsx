/**
 * Sponsor HQ: create and list sideline / rivalry sponsor banners (title, rivalry name) shown on game day.
 * Reads and writes use the initiating Auth lifetime through `lib/sponsorAds.ts`; old completions cannot refetch or alert in an incoming HQ.
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
import { colors, KIT } from '@/constants/theme';
import { useAppRuntime } from '@/context/AppRuntimeContext';
import { useAuth } from '@/context/AuthContext';
import { assertCurrent, createOfflineActorClient } from '@/lib/offlineActor';
import { offlineQueue } from '@/services/OfflineQueue';
import { telemetry } from '@/services/TelemetryManager';
import { createSponsorAd, fetchSponsorAds, setSponsorAdActive } from '@/lib/sponsorAds';
import type { SponsorAd } from '@/types/database';

export default function SponsorHomeScreen() {
  const { live } = useAppRuntime();
  const { user, isSessionCurrent } = useAuth();
  const owner = user?.id ?? null;
  const lifetime = useRef({ owner, guard: isSessionCurrent, active: false, read: 0, busy: false });
  if (lifetime.current.owner !== owner || lifetime.current.guard !== isSessionCurrent) lifetime.current = { owner, guard: isSessionCurrent, active: false, read: 0, busy: false };
  const scope = lifetime.current;
  const current = useCallback(() => lifetime.current === scope && scope.active && (scope.guard?.() ?? true), [scope]);
  useEffect(() => { scope.active = true; return () => { scope.active = false; ++scope.read; }; }, [scope]);
  const [ads, setAds] = useState<SponsorAd[]>([]);
  const [title, setTitle] = useState('Friday Lights presented by Alpine Credit Union');
  const [rivalry, setRivalry] = useState('Westlake vs Lone Peak');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadAds = useCallback(async () => {
    if (!current()) return;
    const revision = ++scope.read;
    const actor = owner ? offlineQueue.captureActor(owner) : null;
    if (!actor) { setAds([]); setLoadError(null); setLoading(false); return; }
    const accepted = () => current() && actor.isCurrent() && revision === scope.read;
    setLoading(true);
    setLoadError(null);
    try {
      const client = await createOfflineActorClient(actor);
      if (!accepted()) return;
      assertCurrent(actor);
      const result = await fetchSponsorAds(client);
      if (!accepted()) return;
      setAds(result.ads); setLoadError(result.error);
    } catch {
      if (accepted()) { setAds([]); setLoadError('Could not load live placements. Try again.'); }
    } finally { if (accepted()) setLoading(false); }
  }, [current, owner, scope]);

  useEffect(() => {
    void loadAds();
  }, [loadAds]);

  const saveAd = async (placement: string) => {
    if (!current() || scope.busy || !owner) return;
    const actor = offlineQueue.captureActor(owner);
    if (!actor) return;
    const accepted = () => current() && actor.isCurrent();
    scope.busy = true; setBusy(true);
    try {
      const client = await createOfflineActorClient(actor);
      if (!accepted()) return;
      assertCurrent(actor);
      telemetry.trackFeature(placement === 'rivalry-banner' ? 'sponsor_rivalry' : 'sponsor_sideline', 'sponsor');
      const result = await createSponsorAd({
        title,
        placement,
        rivalry: rivalry || null,
      }, client);
      if (!accepted()) return;
      if (!result.ok) {
        Alert.alert('Couldn’t save ad', result.message);
        return;
      }
      void loadAds();
    } catch {
      if (accepted()) Alert.alert('Couldn’t save ad', 'Could not save the placement. Refresh before trying again.');
    } finally {
      scope.busy = false;
      if (accepted()) setBusy(false);
    }
  };

  const toggleAd = async (ad: SponsorAd) => {
    if (!current() || scope.busy || !owner) return;
    const actor = offlineQueue.captureActor(owner);
    if (!actor) return;
    const accepted = () => current() && actor.isCurrent();
    scope.busy = true; setBusy(true); ++scope.read;
    try {
      const client = await createOfflineActorClient(actor);
      if (!accepted()) return;
      assertCurrent(actor);
      const result = await setSponsorAdActive(ad.id, !ad.is_active, client);
      if (!accepted()) return;
      if (!result.ok) {
        Alert.alert('Update failed', result.message);
        return;
      }
      ++scope.read;
      setAds((rows) =>
        accepted() ? rows.map((item) => (item.id === ad.id ? { ...item, is_active: !ad.is_active } : item)) : rows,
      );
    } catch {
      if (accepted()) Alert.alert('Update failed', 'Could not save the placement status.');
    } finally {
      scope.busy = false;
      if (accepted()) { setBusy(false); setLoading(false); }
    }
  };

  return (
    <ScreenShell>
      <Stack.Screen options={{ title: 'Sponsor' }} />
      <ScrollView contentContainerStyle={styles.content}>
        <ScreenHeading
          kicker="Tapua'i sponsor"
          title="Sponsor Studio"
          lede={live.copy.sponsorLede}
          accent={FOCAL.jadeInk}
        />
        <FamilyFunDiscovery />
        <DashboardPanel title="Digital stadium ad manager">
          <TextInput value={title} onChangeText={setTitle} style={styles.input} />
          <Pressable
            accessibilityRole="button"
            disabled={busy}
            onPress={() => void saveAd('sideline-board')}
            style={[styles.primary, busy && { opacity: 0.5 }]}
          >
            <Text style={styles.primaryLabel}>Place sideline board ad</Text>
          </Pressable>
        </DashboardPanel>
        <DashboardPanel title="Rivalry banner placement">
          <TextInput value={rivalry} onChangeText={setRivalry} style={styles.input} />
          <Pressable
            accessibilityRole="button"
            disabled={busy}
            onPress={() => void saveAd('rivalry-banner')}
            style={[styles.secondary, busy && { opacity: 0.5 }]}
          >
            <Text style={styles.secondaryLabel}>Publish rivalry banner</Text>
          </Pressable>
        </DashboardPanel>
        <DashboardPanel title="Live placements">
          {loadError ? (
            <EmptyState
              kicker="Placements"
              title="Could not load live placements"
              lede={loadError}
              actionLabel="Retry"
              onAction={() => void loadAds()}
            />
          ) : !loading && ads.length === 0 ? (
            <Text style={styles.muted}>No ads yet.</Text>
          ) : !loading ? (
            ads.map((ad) => (
              <View key={ad.id} style={styles.row}>
                <Text style={styles.name}>
                  {ad.title} · {ad.placement}
                  {ad.rivalry ? ` · ${ad.rivalry}` : ''}
                </Text>
                <Pressable
                  accessibilityRole="button"
                  disabled={busy}
                  onPress={() => void toggleAd(ad)}
                >
                  <Text style={styles.link}>{ad.is_active ? 'Pause' : 'Activate'}</Text>
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
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: KIT.controlRadius,
    paddingHorizontal: 14,
    minHeight: 48,
    paddingVertical: 10,
    fontSize: 15,
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
  secondary: {
    backgroundColor: colors.accentSoft,
    borderRadius: KIT.controlRadius,
    minHeight: 52,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryLabel: {
    color: colors.onAccent,
    fontWeight: '800',
  },
  secondaryLabel: {
    color: colors.primary,
    fontWeight: '800',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  name: {
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
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

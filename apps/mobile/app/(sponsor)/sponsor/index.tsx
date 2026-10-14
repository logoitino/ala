/**
 * Sponsor HQ: create and list sideline / rivalry sponsor banners (title, rivalry name) shown on game day.
 * Reads and writes go through `lib/sponsorAds.ts`; failures show Retry instead of an empty list.
 */

import { useCallback, useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { HapticPressable as Pressable } from '@/components/UI/HapticPressable';
import { Stack } from 'expo-router';

import { DashboardPanel } from '@/components/DashboardPanel';
import { ScreenHeading } from '@/components/ScreenHeading';
import { FamilyFunDiscovery } from '@/components/FamilyFun/FamilyFunDiscovery';
import { ScreenShell } from '@/components/ScreenShell';
import { EmptyState } from '@/components/UI/EmptyState';
import { colors, radii } from '@/constants/theme';
import { useAppRuntime } from '@/context/AppRuntimeContext';
import { telemetry } from '@/services/TelemetryManager';
import { createSponsorAd, fetchSponsorAds, setSponsorAdActive } from '@/lib/sponsorAds';
import type { SponsorAd } from '@/types/database';

export default function SponsorHomeScreen() {
  const { live } = useAppRuntime();
  const [ads, setAds] = useState<SponsorAd[]>([]);
  const [title, setTitle] = useState('Friday Lights presented by Alpine Credit Union');
  const [rivalry, setRivalry] = useState('Westlake vs Lone Peak');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadAds = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    const result = await fetchSponsorAds();
    setAds(result.ads);
    setLoadError(result.error);
    setLoading(false);
  }, []);

  useEffect(() => {
    void loadAds();
  }, [loadAds]);

  const saveAd = async (placement: string) => {
    if (busy) return;
    setBusy(true);
    try {
      telemetry.trackFeature(placement === 'rivalry-banner' ? 'sponsor_rivalry' : 'sponsor_sideline', 'sponsor');
      const result = await createSponsorAd({
        title,
        placement,
        rivalry: rivalry || null,
      });
      if (!result.ok) {
        Alert.alert('Couldn’t save ad', result.message);
        return;
      }
      void loadAds();
    } finally {
      setBusy(false);
    }
  };

  const toggleAd = async (ad: SponsorAd) => {
    if (busy) return;
    setBusy(true);
    try {
      const result = await setSponsorAdActive(ad.id, !ad.is_active);
      if (!result.ok) {
        Alert.alert('Update failed', result.message);
        return;
      }
      setAds((current) =>
        current.map((item) => (item.id === ad.id ? { ...item, is_active: !item.is_active } : item)),
      );
    } finally {
      setBusy(false);
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
            <Text style={styles.primaryLabel}>Publish rivalry banner</Text>
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
    borderRadius: radii.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: colors.text,
    backgroundColor: colors.background,
  },
  primary: {
    backgroundColor: colors.deepGreen,
    borderRadius: radii.md,
    paddingVertical: 14,
    alignItems: 'center',
  },
  secondary: {
    backgroundColor: colors.accent,
    borderRadius: radii.md,
    paddingVertical: 14,
    alignItems: 'center',
  },
  primaryLabel: {
    color: colors.onAccent,
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
    color: colors.accent,
    fontWeight: '800',
  },
});

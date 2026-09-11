import { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Stack } from 'expo-router';

import { DashboardPanel } from '@/components/DashboardPanel';
import { ScreenShell } from '@/components/ScreenShell';
import { colors, radii } from '@/constants/theme';
import { supabase } from '@/lib/supabase';
import type { SponsorAd } from '@/types/database';

export default function SponsorHomeScreen() {
  const [ads, setAds] = useState<SponsorAd[]>([]);
  const [title, setTitle] = useState('Friday Lights presented by Alpine Credit Union');
  const [rivalry, setRivalry] = useState('Westlake vs Lone Peak');

  const loadAds = useCallback(async () => {
    const { data } = await supabase.from('sponsor_ads').select('*').order('title');
    setAds((data as SponsorAd[] | null) ?? []);
  }, []);

  useEffect(() => {
    void loadAds();
  }, [loadAds]);

  const saveAd = async (placement: string) => {
    const { error } = await supabase.from('sponsor_ads').insert({
      title,
      placement,
      rivalry: rivalry || null,
      is_active: true,
    });
    if (error) {
      Alert.alert('Couldn’t save ad', error.message);
      return;
    }
    void loadAds();
  };

  const toggleAd = async (ad: SponsorAd) => {
    const { error } = await supabase
      .from('sponsor_ads')
      .update({ is_active: !ad.is_active })
      .eq('id', ad.id);
    if (error) {
      Alert.alert('Update failed', error.message);
      return;
    }
    setAds((current) =>
      current.map((item) => (item.id === ad.id ? { ...item, is_active: !item.is_active } : item)),
    );
  };

  return (
    <ScreenShell>
      <Stack.Screen options={{ title: 'Sponsor' }} />
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.heading}>Sponsor Studio</Text>
        <DashboardPanel title="Digital stadium ad manager">
          <TextInput value={title} onChangeText={setTitle} style={styles.input} />
          <Pressable
            accessibilityRole="button"
            onPress={() => void saveAd('sideline-board')}
            style={styles.primary}
          >
            <Text style={styles.primaryLabel}>Place sideline board ad</Text>
          </Pressable>
        </DashboardPanel>
        <DashboardPanel title="Rivalry banner placement">
          <TextInput value={rivalry} onChangeText={setRivalry} style={styles.input} />
          <Pressable
            accessibilityRole="button"
            onPress={() => void saveAd('rivalry-banner')}
            style={styles.secondary}
          >
            <Text style={styles.primaryLabel}>Publish rivalry banner</Text>
          </Pressable>
        </DashboardPanel>
        <DashboardPanel title="Live placements">
          {ads.length === 0 ? (
            <Text style={styles.muted}>No ads yet.</Text>
          ) : (
            ads.map((ad) => (
              <View key={ad.id} style={styles.row}>
                <Text style={styles.name}>
                  {ad.title} · {ad.placement}
                  {ad.rivalry ? ` · ${ad.rivalry}` : ''}
                </Text>
                <Pressable onPress={() => void toggleAd(ad)}>
                  <Text style={styles.link}>{ad.is_active ? 'Pause' : 'Activate'}</Text>
                </Pressable>
              </View>
            ))
          )}
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
  heading: {
    fontSize: 28,
    fontWeight: '800',
    color: colors.text,
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
    backgroundColor: colors.primary,
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
    color: '#FFFFFF',
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

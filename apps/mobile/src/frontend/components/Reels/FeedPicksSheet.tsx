/**
 * FEED-01 first-run / Settings Highlights picks: up to 3 sports, up to 3 schools, one category lean.
 * Skippable ("Not now"). Guests never see this sheet. No restyle beyond existing sheet chrome.
 * @sideEffects Saves via `useFeedPrefs` → `user_feed_prefs`.
 */
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Modal, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AnimatedButton } from '@/components/UI/AnimatedButton';
import { HapticPressable as Pressable } from '@/components/UI/HapticPressable';
import { MenuBackdrop } from '@/components/UI/MenuChrome';
import { SheetHandle } from '@/components/UI/SheetHandle';
import { colors } from '@/constants/theme';
import {
  REEL_CATEGORY_GAME,
  REEL_CATEGORY_SERVE,
  REEL_CATEGORY_TRAIN,
  type FeedCategoryLean,
  type UserFeedPrefs,
} from '@/data/highlights';
import { SPORT_CONFIG_SEEDS } from '@/data/sports';
import { FOCAL } from '@/theme/motion';

const CATEGORY_OPTIONS: { id: FeedCategoryLean; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: REEL_CATEGORY_GAME, label: 'Game Day' },
  { id: REEL_CATEGORY_TRAIN, label: 'Train Like Me' },
  { id: REEL_CATEGORY_SERVE, label: 'Serve Like Me' },
];

type FeedPicksSheetProps = {
  visible: boolean;
  title?: string;
  prefs: UserFeedPrefs;
  sportOptions: string[];
  schoolOptions: string[];
  busy?: boolean;
  error?: string | null;
  allowSkip?: boolean;
  onClose: () => void;
  onSkip?: () => void;
  onSave: (next: UserFeedPrefs) => Promise<unknown> | unknown;
};

function togglePick(list: string[], value: string, max: number): string[] {
  const trimmed = value.trim();
  if (!trimmed) return list;
  if (list.some((row) => row.toLowerCase() === trimmed.toLowerCase())) {
    return list.filter((row) => row.toLowerCase() !== trimmed.toLowerCase());
  }
  if (list.length >= max) return list;
  return [...list, trimmed];
}

/**
 * @purpose One-screen Highlights interest picks (≤6 taps to finish). Used for first-run and Settings.
 */
export function FeedPicksSheet({
  visible,
  title = 'Shape your Highlights',
  prefs,
  sportOptions,
  schoolOptions,
  busy = false,
  error = null,
  allowSkip = true,
  onClose,
  onSkip,
  onSave,
}: FeedPicksSheetProps) {
  const insets = useSafeAreaInsets();
  const [sports, setSports] = useState(prefs.sports);
  const [schools, setSchools] = useState(prefs.schools);
  const [categoryPref, setCategoryPref] = useState<FeedCategoryLean>(prefs.categoryPref);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setSports(prefs.sports);
    setSchools(prefs.schools);
    setCategoryPref(prefs.categoryPref);
  }, [prefs.categoryPref, prefs.schools, prefs.sports, visible]);

  const sportsList = useMemo(() => {
    const fromSeeds = SPORT_CONFIG_SEEDS.filter((row) => row.isActive).map((row) => row.sport);
    const merged = [...sportOptions, ...fromSeeds];
    const out: string[] = [];
    for (const sport of merged) {
      const trimmed = sport.trim();
      if (!trimmed) continue;
      if (out.some((row) => row.toLowerCase() === trimmed.toLowerCase())) continue;
      out.push(trimmed);
    }
    return out;
  }, [sportOptions]);

  const schoolsList = useMemo(() => {
    const out: string[] = [];
    for (const school of schoolOptions) {
      const trimmed = school.trim();
      if (!trimmed) continue;
      if (out.some((row) => row.toLowerCase() === trimmed.toLowerCase())) continue;
      out.push(trimmed);
    }
    return out;
  }, [schoolOptions]);

  if (!visible) return null;

  return (
    <Modal transparent animationType="fade" visible={visible} onRequestClose={onClose}>
      <View style={[styles.root, { paddingBottom: Math.max(insets.bottom, 12) }]}>
        <Pressable haptic="none" style={styles.backdrop} onPress={onClose} accessibilityLabel="Close" />
        <View style={styles.sheet}>
          <MenuBackdrop accent="jade" />
          <SheetHandle onDismiss={onClose} />
          <Text style={styles.kicker}>Highlights</Text>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.body}>
            Pick up to 3 sports and 3 schools. We use these only to order your Home feed — never for ads.
          </Text>
          <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
            <Text style={styles.section}>Sports (up to 3)</Text>
            <View style={styles.wrap}>
              {sportsList.map((sport) => {
                const on = sports.some((row) => row.toLowerCase() === sport.toLowerCase());
                return (
                  <Pressable
                    key={sport}
                    accessibilityRole="button"
                    accessibilityState={{ selected: on }}
                    accessibilityLabel={`Sport ${sport}`}
                    haptic="selection"
                    onPress={() => setSports((current) => togglePick(current, sport, 3))}
                    style={[styles.chip, on && styles.chipOn]}
                  >
                    <Text style={[styles.chipLabel, on && styles.chipLabelOn]}>{sport}</Text>
                  </Pressable>
                );
              })}
            </View>
            <Text style={styles.section}>Schools (up to 3)</Text>
            <View style={styles.wrap}>
              {schoolsList.length === 0 ? (
                <Text style={styles.hint}>No schools on this feed yet. You can edit this later in Settings.</Text>
              ) : (
                schoolsList.map((school) => {
                  const on = schools.some((row) => row.toLowerCase() === school.toLowerCase());
                  return (
                    <Pressable
                      key={school}
                      accessibilityRole="button"
                      accessibilityState={{ selected: on }}
                      accessibilityLabel={`School ${school}`}
                      haptic="selection"
                      onPress={() => setSchools((current) => togglePick(current, school, 3))}
                      style={[styles.chip, on && styles.chipOn]}
                    >
                      <Text style={[styles.chipLabel, on && styles.chipLabelOn]} numberOfLines={1}>
                        {school}
                      </Text>
                    </Pressable>
                  );
                })
              )}
            </View>
            <Text style={styles.section}>Category lean</Text>
            <View style={styles.wrap}>
              {CATEGORY_OPTIONS.map((option) => {
                const on = categoryPref === option.id;
                return (
                  <Pressable
                    key={option.id}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: on }}
                    accessibilityLabel={`Category ${option.label}`}
                    haptic="selection"
                    onPress={() => setCategoryPref(option.id)}
                    style={[styles.chip, on && styles.chipOn]}
                  >
                    <Text style={[styles.chipLabel, on && styles.chipLabelOn]}>{option.label}</Text>
                  </Pressable>
                );
              })}
            </View>
            {error ? <Text style={styles.error}>{error}</Text> : null}
          </ScrollView>
          <View style={styles.actions}>
            {allowSkip ? (
              <AnimatedButton
                accessibilityLabel="Not now"
                haptic="selection"
                onPress={() => onSkip?.()}
                style={styles.secondary}
              >
                <Text style={styles.secondaryLabel}>Not now</Text>
              </AnimatedButton>
            ) : null}
            <AnimatedButton
              accessibilityLabel="Save Highlights picks"
              haptic="medium"
              disabled={busy || saving}
              onPress={() => {
                setSaving(true);
                void Promise.resolve(
                  onSave({
                    sports,
                    schools,
                    categoryPref,
                    personalizationOn: prefs.personalizationOn !== false,
                  }),
                ).finally(() => setSaving(false));
              }}
              style={styles.primary}
            >
              {saving || busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryLabel}>Save</Text>}
            </AnimatedButton>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(8,16,28,0.45)' },
  backdrop: { ...StyleSheet.absoluteFill },
  sheet: {
    marginHorizontal: 10,
    borderRadius: 24,
    overflow: 'hidden',
    backgroundColor: colors.surface,
    maxHeight: '88%',
    paddingBottom: 12,
  },
  kicker: {
    marginTop: 4,
    marginHorizontal: 20,
    color: FOCAL.neonJade,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  title: { marginHorizontal: 20, marginTop: 4, color: colors.text, fontSize: 22, fontWeight: '800' },
  body: { marginHorizontal: 20, marginTop: 6, marginBottom: 8, color: colors.textMuted, fontSize: 14, lineHeight: 20 },
  scroll: { maxHeight: 420 },
  scrollContent: { paddingHorizontal: 20, paddingBottom: 12, gap: 8 },
  section: { marginTop: 10, color: colors.text, fontSize: 13, fontWeight: '700' },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    minHeight: 44,
    paddingHorizontal: 14,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipOn: { borderColor: FOCAL.neonJade, backgroundColor: 'rgba(16,185,129,0.14)' },
  chipLabel: { color: colors.text, fontSize: 14, fontWeight: '600' },
  chipLabelOn: { color: FOCAL.neonJade },
  hint: { color: colors.textMuted, fontSize: 13, lineHeight: 18 },
  error: { color: colors.danger, fontSize: 13, marginTop: 8 },
  actions: { flexDirection: 'row', gap: 10, paddingHorizontal: 20, paddingTop: 8 },
  secondary: {
    flex: 1,
    minHeight: 48,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryLabel: { color: colors.text, fontWeight: '700', fontSize: 15 },
  primary: {
    flex: 1,
    minHeight: 48,
    borderRadius: 14,
    backgroundColor: FOCAL.neonJade,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryLabel: { color: '#fff', fontWeight: '800', fontSize: 15 },
});

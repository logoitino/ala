/**
 * FEED-01 first-run / Settings Highlights picks: up to 3 sports, up to 3 schools, one category lean.
 * Skippable ("Not now"). Guests never see this sheet.
 * Sports/schools use vertical scroll menus; the opted-in web workspace places them side by side with visible category choices. Native and ordinary first-run presentation remain unchanged.
 * @sideEffects Saves via `useFeedPrefs` → `user_feed_prefs`.
 */
import { useContext, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Modal, Platform, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AnimatedButton } from '@/components/UI/AnimatedButton';
import { HapticPressable as Pressable } from '@/components/UI/HapticPressable';
import { MenuBackdrop } from '@/components/UI/MenuChrome';
import { SheetHandle } from '@/components/UI/SheetHandle';
import { colors, MENU_METRICS } from '@/constants/theme';
import {
  REEL_CATEGORY_GAME,
  REEL_CATEGORY_SERVE,
  REEL_CATEGORY_TRAIN,
  type FeedCategoryLean,
  type UserFeedPrefs,
} from '@/data/highlights';
import { SPORT_CONFIG_SEEDS } from '@/data/sports';
import { FOCAL } from '@/theme/motion';
import { TYPE, figtree } from '@/theme/fonts';
import { SheetPresentationContext } from '@/components/UI/SheetPresentationContext';

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

function summarizePicks(list: string[], max: number): string {
  if (list.length === 0) return `0 of ${max}`;
  return `${list.length} of ${max} · ${list.join(', ')}`;
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
  const window = useWindowDimensions();
  const workspace = useContext(SheetPresentationContext) === 'web-workspace' && Platform.OS === 'web' && window.width >= 820;
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

  const categoryLabel = CATEGORY_OPTIONS.find((row) => row.id === categoryPref)?.label ?? 'All';

  const sportControls = (
    <>
      <Text style={styles.fieldLabel}>Sports · {summarizePicks(sports, 3)}</Text>
      <ScrollView
        nestedScrollEnabled
        style={[styles.menuList, workspace && styles.workspaceMenu]}
        contentContainerStyle={styles.menuListContent}
        showsVerticalScrollIndicator
      >
        {sportsList.map((sport) => {
          const on = sports.some((row) => row.toLowerCase() === sport.toLowerCase());
          const full = !on && sports.length >= 3;
          return (
            <Pressable
              key={sport}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: on, disabled: full }}
              accessibilityLabel={`Sport ${sport}`}
              haptic="selection"
              disabled={full}
              onPress={() => setSports((current) => togglePick(current, sport, 3))}
              style={[styles.menuRow, on && styles.menuRowOn, full && styles.menuRowDim]}
            >
              <Text style={[styles.menuRowLabel, workspace && styles.workspaceRowLabel, on && styles.menuRowLabelOn]}>{sport}</Text>
              {on ? <Text style={styles.menuCheck}>✓</Text> : null}
            </Pressable>
          );
        })}
      </ScrollView>
    </>
  );
  const schoolControls = (
    <>
      <Text style={styles.fieldLabel}>Schools · {summarizePicks(schools, 3)}</Text>
      {schoolsList.length === 0 ? (
        <Text style={styles.hint}>No schools on this feed yet. You can edit this later in Settings.</Text>
      ) : (
        <ScrollView
          nestedScrollEnabled
          style={[styles.menuListShort, workspace && styles.workspaceMenu]}
          contentContainerStyle={styles.menuListContent}
          showsVerticalScrollIndicator
        >
          {schoolsList.map((school) => {
            const on = schools.some((row) => row.toLowerCase() === school.toLowerCase());
            const full = !on && schools.length >= 3;
            return (
              <Pressable
                key={school}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: on, disabled: full }}
                accessibilityLabel={`School ${school}`}
                haptic="selection"
                disabled={full}
                onPress={() => setSchools((current) => togglePick(current, school, 3))}
                style={[styles.menuRow, on && styles.menuRowOn, full && styles.menuRowDim]}
              >
                <Text style={[styles.menuRowLabel, workspace && styles.workspaceRowLabel, on && styles.menuRowLabelOn]} numberOfLines={workspace ? undefined : 1}>
                  {school}
                </Text>
                {on ? <Text style={styles.menuCheck}>✓</Text> : null}
              </Pressable>
            );
          })}
        </ScrollView>
      )}
    </>
  );
  const CategoryContainer = workspace ? View : ScrollView;

  if (!visible) return null;

  return (
    <Modal transparent animationType="fade" visible={visible} onRequestClose={onClose}>
      <View style={[styles.root, { paddingBottom: Math.max(insets.bottom, 12) }, workspace && styles.workspaceRoot]}>
        <Pressable haptic="none" style={styles.backdrop} onPress={onClose} accessibilityLabel="Close" />
        <View testID="highlights-picks-panel" style={[styles.sheet, workspace && styles.workspaceSheet, workspace && { maxHeight: window.height - 48 }]}>
          <MenuBackdrop accent="jade" />
          {workspace ? (
            <Pressable accessibilityRole="button" accessibilityLabel="Back to Highlights settings"
              haptic="selection" onPress={onClose} style={styles.workspaceBack}>
              <Text style={styles.workspaceBackLabel}>‹ Back to Highlights settings</Text>
            </Pressable>
          ) : <SheetHandle onDismiss={onClose} />}
          <Text style={styles.kicker}>Highlights</Text>
          <Text style={[styles.title, workspace && styles.workspaceTitle]}>{title}</Text>
          <Text style={[styles.body, workspace && styles.workspaceBody]}>
            Pick sports and schools for your Home feed. Stored on your account only — never for ads.
          </Text>

          <ScrollView
            style={[styles.scroll, workspace && styles.workspaceScroll]}
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {workspace ? <View testID="highlights-picks-columns" style={styles.workspaceColumns}>
              <View style={styles.workspaceColumn}>{sportControls}</View>
              <View style={styles.workspaceColumn}>{schoolControls}</View>
            </View> : <>{sportControls}{schoolControls}</>}

            <Text style={styles.fieldLabel}>Category lean · {categoryLabel}</Text>
            <CategoryContainer accessibilityRole={workspace ? "radiogroup" : undefined}
              accessibilityLabel={workspace ? "Highlights category" : undefined} {...(workspace ? { style: styles.workspaceCategories } : { horizontal: true, nestedScrollEnabled: true, showsHorizontalScrollIndicator: false, contentContainerStyle: styles.menuRail })}>
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
                    style={[styles.railChip, on && styles.railChipOn]}
                  >
                    <Text style={[styles.railChipLabel, on && styles.railChipLabelOn]}>{option.label}</Text>
                  </Pressable>
                );
              })}
            </CategoryContainer>

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
              style={[styles.primary, workspace && styles.workspacePrimary]}
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
  workspaceRoot: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24, paddingTop: 24, paddingBottom: 24 },
  workspaceSheet: { width: '100%', maxWidth: 760, marginHorizontal: 0, borderRadius: MENU_METRICS.sheetRadius },
  workspaceScroll: { maxHeight: undefined, flexShrink: 1 },
  workspaceColumns: { flexDirection: 'row', gap: 20, alignItems: 'flex-start' },
  workspaceColumn: { flex: 1, minWidth: 0, gap: 8 },
  workspaceMenu: { maxHeight: 240 },
  workspaceCategories: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  workspaceBack: { minHeight: 44, marginHorizontal: 20, alignSelf: 'flex-start', justifyContent: 'center', paddingHorizontal: 4 },
  workspaceBackLabel: { ...TYPE.button, ...figtree('700'), color: colors.primary },
  workspacePrimary: { backgroundColor: colors.primary },
  workspaceTitle: { ...TYPE.title, ...figtree('800') },
  workspaceBody: { ...TYPE.body, ...figtree('400') },
  workspaceRowLabel: { ...TYPE.body, ...figtree('600'), paddingVertical: 10 },
  root: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(8,16,28,0.45)' },
  backdrop: { ...StyleSheet.absoluteFill },
  sheet: {
    marginHorizontal: 10,
    borderRadius: 24,
    overflow: 'hidden',
    backgroundColor: colors.surface,
    maxHeight: '88%',
    paddingBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  kicker: {
    marginTop: 4,
    marginHorizontal: 20,
    color: FOCAL.jadeInk,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  title: {
    marginHorizontal: 20,
    marginTop: 4,
    color: colors.text,
    fontSize: 22,
    fontWeight: '800',
  },
  body: {
    marginHorizontal: 20,
    marginTop: 6,
    marginBottom: 4,
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600',
  },
  scroll: { maxHeight: 440 },
  scrollContent: { paddingHorizontal: 20, paddingBottom: 12, gap: 8 },
  fieldLabel: {
    marginTop: 8,
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  menuList: {
    maxHeight: 168,
    borderRadius: MENU_METRICS.controlRadius,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
  },
  menuListShort: {
    maxHeight: 120,
    borderRadius: MENU_METRICS.controlRadius,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
  },
  menuListContent: { paddingVertical: 4 },
  menuRow: {
    minHeight: 44,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  menuRowOn: { backgroundColor: FOCAL.mistJade },
  menuRowDim: { opacity: 0.45 },
  menuRowLabel: { flex: 1, color: colors.text, fontSize: 15, fontWeight: '700' },
  menuRowLabelOn: { color: FOCAL.jadeInk },
  menuCheck: { color: FOCAL.jadeInk, fontSize: 15, fontWeight: '800' },
  menuRail: { gap: 8, paddingVertical: 2, paddingRight: 4 },
  railChip: {
    minHeight: 44,
    paddingHorizontal: 14,
    borderRadius: MENU_METRICS.controlRadius,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  railChipOn: {
    backgroundColor: FOCAL.mistJade,
    borderColor: FOCAL.jadeInk,
  },
  railChipLabel: { color: colors.textMuted, fontSize: 14, fontWeight: '800' },
  railChipLabelOn: { color: FOCAL.jadeInk },
  hint: { color: colors.textMuted, fontSize: 13, lineHeight: 18, fontWeight: '600' },
  error: { color: colors.danger, fontSize: 13, marginTop: 8 },
  actions: { flexDirection: 'row', gap: 10, paddingHorizontal: 20, paddingTop: 8 },
  secondary: {
    flex: 1,
    minHeight: 48,
    borderRadius: MENU_METRICS.controlRadius,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryLabel: { color: colors.text, fontWeight: '700', fontSize: 15 },
  primary: {
    flex: 1,
    minHeight: 48,
    borderRadius: MENU_METRICS.controlRadius,
    backgroundColor: FOCAL.neonJade,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryLabel: { color: '#fff', fontWeight: '800', fontSize: 15 },
});

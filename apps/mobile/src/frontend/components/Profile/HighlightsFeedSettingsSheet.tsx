/**
 * Settings → Highlights: personal feed toggle + edit picks (FEED-01).
 * Off = newest-first Home with no rankHomeFeed bonuses. Guests never open this sheet.
 * @sideEffects Saves `user_feed_prefs` through `useFeedPrefs`.
 */
import { useState } from 'react';
import { ActivityIndicator, Modal, StyleSheet, Switch, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { FeedPicksSheet } from '@/components/Reels/FeedPicksSheet';
import { AnimatedButton } from '@/components/UI/AnimatedButton';
import { HapticPressable as Pressable } from '@/components/UI/HapticPressable';
import { MenuBackdrop } from '@/components/UI/MenuChrome';
import { SheetHandle } from '@/components/UI/SheetHandle';
import { colors } from '@/constants/theme';
import type { UserFeedPrefs } from '@/data/highlights';
import { FOCAL } from '@/theme/motion';

type HighlightsFeedSettingsSheetProps = {
  visible: boolean;
  prefs: UserFeedPrefs;
  sportOptions: string[];
  schoolOptions: string[];
  busy?: boolean;
  error?: string | null;
  onClose: () => void;
  onSave: (next: UserFeedPrefs) => Promise<unknown> | unknown;
  onTogglePersonalization: (on: boolean) => Promise<unknown> | unknown;
};

/**
 * @purpose Settings > Highlights surface for Personal feed + edit picks.
 */
export function HighlightsFeedSettingsSheet({
  visible,
  prefs,
  sportOptions,
  schoolOptions,
  busy = false,
  error = null,
  onClose,
  onSave,
  onTogglePersonalization,
}: HighlightsFeedSettingsSheetProps) {
  const insets = useSafeAreaInsets();
  const [picksOpen, setPicksOpen] = useState(false);
  const [toggling, setToggling] = useState(false);

  if (!visible && !picksOpen) return null;

  return (
    <>
      <Modal transparent animationType="fade" visible={visible && !picksOpen} onRequestClose={onClose}>
        <View style={[styles.root, { paddingBottom: Math.max(insets.bottom, 12) }]}>
          <Pressable haptic="none" style={styles.backdrop} onPress={onClose} accessibilityLabel="Close" />
          <View style={styles.sheet}>
            <MenuBackdrop accent="jade" />
            <SheetHandle onDismiss={onClose} />
            <Text style={styles.kicker}>Settings</Text>
            <Text style={styles.title}>Highlights</Text>
            <Text style={styles.body}>
              Personal feed orders Home by your picks and Crew. Turn it off for plain newest-first. Picks are never used
              for ads.
            </Text>
            <View style={styles.row}>
              <View style={styles.rowCopy}>
                <Text style={styles.rowTitle}>Personal feed</Text>
                <Text style={styles.rowHint}>When off, Home is newest first with no ranking bonuses.</Text>
              </View>
              {toggling || busy ? (
                <ActivityIndicator color={FOCAL.neonJade} />
              ) : (
                <Switch
                  accessibilityLabel="Personal feed"
                  value={prefs.personalizationOn !== false}
                  onValueChange={(on) => {
                    setToggling(true);
                    void Promise.resolve(onTogglePersonalization(on)).finally(() => setToggling(false));
                  }}
                  trackColor={{ false: colors.border, true: FOCAL.neonJade }}
                />
              )}
            </View>
            <AnimatedButton
              accessibilityLabel="Edit Highlights picks"
              haptic="selection"
              onPress={() => setPicksOpen(true)}
              style={styles.edit}
            >
              <Text style={styles.editLabel}>Edit sports, schools & lean</Text>
            </AnimatedButton>
            {error ? <Text style={styles.error}>{error}</Text> : null}
            <AnimatedButton accessibilityLabel="Done" haptic="selection" onPress={onClose} style={styles.done}>
              <Text style={styles.doneLabel}>Done</Text>
            </AnimatedButton>
          </View>
        </View>
      </Modal>
      <FeedPicksSheet
        visible={picksOpen}
        title="Edit Highlights picks"
        prefs={prefs}
        sportOptions={sportOptions}
        schoolOptions={schoolOptions}
        busy={busy}
        error={error}
        allowSkip={false}
        onClose={() => setPicksOpen(false)}
        onSave={async (next) => {
          await onSave(next);
          setPicksOpen(false);
        }}
      />
    </>
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
    paddingBottom: 16,
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
  body: { marginHorizontal: 20, marginTop: 6, marginBottom: 12, color: colors.textMuted, fontSize: 14, lineHeight: 20 },
  row: {
    marginHorizontal: 20,
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 8,
  },
  rowCopy: { flex: 1, gap: 2 },
  rowTitle: { color: colors.text, fontSize: 16, fontWeight: '700' },
  rowHint: { color: colors.textMuted, fontSize: 13, lineHeight: 18 },
  edit: {
    marginHorizontal: 20,
    marginTop: 8,
    minHeight: 48,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  editLabel: { color: colors.text, fontWeight: '700', fontSize: 15 },
  error: { marginHorizontal: 20, marginTop: 8, color: '#c0392b', fontSize: 13 },
  done: {
    marginHorizontal: 20,
    marginTop: 12,
    minHeight: 48,
    borderRadius: 14,
    backgroundColor: FOCAL.neonJade,
    alignItems: 'center',
    justifyContent: 'center',
  },
  doneLabel: { color: '#fff', fontWeight: '800', fontSize: 15 },
});

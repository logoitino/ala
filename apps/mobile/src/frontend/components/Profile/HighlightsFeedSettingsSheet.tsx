/** UX-13 readable shared type preserves every action and required notice.
 * Web account-workspace copy explains each choice once; native keeps its original explanation.
 * Settings → Highlights: personal feed toggle + edit picks (FEED-01).
 * Off = newest-first Home with no rankHomeFeed bonuses. Guests never open this sheet.
 * @sideEffects Saves `user_feed_prefs` through `useFeedPrefs`.
 */
import { useContext, useState } from 'react';
import { ActivityIndicator, Modal, Platform, StyleSheet, Switch, Text, View, ScrollView, useWindowDimensions } from 'react-native';

import { FeedPicksSheet } from '@/components/Reels/FeedPicksSheet';
import { AnimatedButton } from '@/components/UI/AnimatedButton';
import { HapticPressable as Pressable } from '@/components/UI/HapticPressable';
import { MenuBackdrop } from '@/components/UI/MenuChrome';
import { SheetHandle } from '@/components/UI/SheetHandle';
import { useSheetFrame } from '@/hooks/useSheetFrame';
import { colors } from '@/constants/theme';
import type { UserFeedPrefs } from '@/data/highlights';
import { FOCAL } from '@/theme/motion';
import { SheetPresentationContext } from '@/components/UI/SheetPresentationContext';
import { TYPE, figtree } from '@/theme/fonts';

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
  const frame = useSheetFrame();
  const workspace = useContext(SheetPresentationContext) === 'web-workspace' && Platform.OS === 'web';
  const { height: windowHeight } = useWindowDimensions();
  const [picksOpen, setPicksOpen] = useState(false);
  const [toggling, setToggling] = useState(false);

  if (!visible && !picksOpen) return null;

  return (
    <>
      <Modal transparent animationType="fade" visible={visible && !picksOpen} onRequestClose={onClose}>
        <View style={[styles.root, { paddingBottom: 0 }]}>
          <Pressable haptic="none" style={styles.backdrop} onPress={onClose} accessibilityLabel="Close" />
          <View style={frame.dock}><View style={[styles.sheet, frame.card, { maxHeight: windowHeight * 0.85 }]}>
            <MenuBackdrop accent="jade" />
            <SheetHandle onDismiss={onClose} />
            <ScrollView style={styles.bodyScroll} contentContainerStyle={styles.bodyContent}>
            <Text style={styles.kicker}>Settings</Text>
            <Text style={styles.title}>Highlights</Text>
            <Text style={styles.body}>
              {workspace ? 'Choose the sports and schools you want to follow. Your picks are never used for ads.'
                : 'Personal feed orders Home by your picks and Crew. Turn it off for plain newest-first. Picks are never used for ads.'}
            </Text>
            <View style={styles.row}>
              <View style={styles.rowCopy}>
                <Text style={styles.rowTitle}>Personal feed</Text>
                <Text style={styles.rowHint}>{workspace ? 'Turn off to see the newest clips first.' : 'When off, Home is newest first with no ranking bonuses.'}</Text>
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
            </ScrollView>
            <AnimatedButton accessibilityLabel="Done" haptic="selection" onPress={onClose} style={styles.done}>
              <Text style={styles.doneLabel}>Done</Text>
            </AnimatedButton>
          </View></View>
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
  bodyScroll: { flexGrow: 0, flexShrink: 1, minHeight: 0, alignSelf: 'stretch' },
  bodyContent: { gap: 10, paddingBottom: 4 },
  root: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(8,16,28,0.45)' },
  backdrop: { ...StyleSheet.absoluteFill },
  sheet: {

    borderRadius: 24,
    overflow: 'hidden',
    backgroundColor: colors.surface,
    paddingBottom: 16,
  },
  kicker: {
    marginTop: 4,

    color: FOCAL.jadeInk,
    ...TYPE.caption,
    ...figtree('700'),
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  title: { marginTop: 4, color: colors.text, ...TYPE.title, ...figtree('800') },
  body: { ...figtree('400'), marginTop: 6, marginBottom: 12, color: colors.textMuted, ...TYPE.body,  },
  row: {

    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 8,
  },
  rowCopy: { flex: 1, gap: 2 },
  rowTitle: { color: colors.text, ...TYPE.body, ...figtree('700') },
  rowHint: { ...figtree('400'), color: colors.textMuted, ...TYPE.body,  },
  edit: {

    marginTop: 8,
    minHeight: 48,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  editLabel: { color: colors.text, ...figtree('700'), ...TYPE.body },
  error: { ...figtree('400'), marginTop: 8, color: '#c0392b', ...TYPE.body },
  done: {

    marginTop: 12,
    minHeight: 48,
    borderRadius: 14,
    backgroundColor: FOCAL.neonJade,
    alignItems: 'center',
    justifyContent: 'center',
  },
  doneLabel: { color: FOCAL.ink, ...figtree('800'), ...TYPE.body },
});

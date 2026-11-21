/**
 * Highlight trivia notice. It uses the quiz palette (gold, jade, cyan, violet), stays open for a few seconds,
 * then slides to a tab on the left so the Highlight stays visible. Play opens the quiz; Not now hides it.
 * Availability is refreshed by the app. This card only invites the player.
 * @sideEffects A local timer and a width animation. Play is a callback from discovery.
 * UX-13 aligns existing readable type and wrapping without changing any action or notice.
 */
import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Pressable, StyleSheet, Text, View, ScrollView, useWindowDimensions } from 'react-native';
import { FOCAL } from '@/theme/motion';
import { TYPE, figtree } from '@/theme/fonts';

const CARD = 292;
const HANG = 64;
const SHOW_MS = 2600;

/** @purpose Bright trivia invite that tucks to the left edge after a few seconds. */
export function TriviaSideNotice({
  busy,
  subject = 'This week’s five.',
  onPlay,
  onDismiss,
}: {
  busy: boolean;
  /** This week’s subject, already decided by the server. Falls back to the plain invite. */
  subject?: string;
  onPlay: () => void;
  onDismiss: () => void;
}) {
  const { height: windowHeight } = useWindowDimensions();
  const width = useRef(new Animated.Value(CARD)).current;
  const [open, setOpen] = useState(true);
  const [held, setHeld] = useState(false);

  useEffect(() => {
    if (held) return;
    const timer = setTimeout(() => setOpen(false), SHOW_MS);
    return () => clearTimeout(timer);
  }, [held]);

  useEffect(() => {
    let live = true;
    const slide = (reduce: boolean) => {
      if (!live) return;
      Animated.timing(width, { toValue: open ? CARD : HANG, duration: reduce ? 0 : 320, useNativeDriver: false }).start();
    };
    Promise.resolve(AccessibilityInfo.isReduceMotionEnabled?.())
      .then(value => slide(value === true))
      .catch(() => slide(false));
    return () => { live = false; };
  }, [open, width]);

  const tuck = () => { setHeld(true); setOpen(false); };
  const expand = () => { setHeld(true); setOpen(true); };

  return (
    <Animated.View style={[styles.clip, { width }]}>
      <View style={styles.row}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={open ? 'Hide Sport Pop Quiz' : 'Open Sport Pop Quiz'}
          onPress={open ? tuck : expand}
          style={styles.tab}
        >
          <Text style={styles.tabMark}>⚡</Text>
          <Text style={styles.tabWord}>Q{'\n'}U{'\n'}I{'\n'}Z</Text>
        </Pressable>
        <View
          style={styles.panel}
          accessibilityElementsHidden={!open}
          importantForAccessibility={open ? 'auto' : 'no-hide-descendants'}
        >
          <ScrollView style={{ maxHeight: windowHeight * 0.48, flexGrow: 0 }} contentContainerStyle={styles.panelContent}>
          <Text style={styles.kicker}>Trivia</Text>
          <Text style={styles.title}>Pop Quiz</Text>
          <Text style={styles.copy}>{`${subject} You learn a fact either way.`}</Text>
          <Pressable accessibilityRole="button" accessibilityLabel="Play trivia" disabled={busy} onPress={onPlay} style={styles.play}>
            <Text style={styles.playLabel}>Yes, let’s play</Text>
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel="Not now" onPress={onDismiss} style={styles.later}>
            <Text style={styles.laterLabel}>Not now</Text>
          </Pressable>
          </ScrollView>
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  clip: { overflow: 'hidden', borderTopRightRadius: 18, borderBottomRightRadius: 18 },
  row: { width: CARD, flexDirection: 'row', alignItems: 'stretch' },
  panelContent: { gap: 8 },
  panel: {
    width: CARD - HANG,
    gap: 8,
    paddingVertical: 14,
    paddingLeft: 12,
    paddingRight: 14,
    backgroundColor: FOCAL.electricGold,
    borderTopRightRadius: 18,
    borderBottomRightRadius: 18,
    borderTopWidth: 3,
    borderRightWidth: 3,
    borderBottomWidth: 3,
    borderColor: FOCAL.islandCyan,
  },
  kicker: { color: FOCAL.violetInk, ...TYPE.caption, ...figtree('800'), letterSpacing: 1.2 },
  title: { color: FOCAL.ink, ...TYPE.title, ...figtree('900') },
  copy: { ...figtree('400'), color: FOCAL.ink, ...TYPE.body,  },
  play: {
    minHeight: 44,
    borderRadius: 12,
    backgroundColor: FOCAL.neonJade,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  playLabel: { color: FOCAL.ink, ...TYPE.body, ...figtree('800') },
  later: { minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  laterLabel: { color: FOCAL.ink, ...TYPE.body, ...figtree('700') },
  tab: {
    width: HANG,
    minHeight: 148,
    paddingHorizontal: 6,
    backgroundColor: FOCAL.electricViolet,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderTopRightRadius: 18,
    borderBottomRightRadius: 18,
  },
  tabMark: { fontSize: 18 },
  tabWord: { color: '#FFFFFF', ...TYPE.body, ...figtree('900'),  textAlign: 'center' },
});

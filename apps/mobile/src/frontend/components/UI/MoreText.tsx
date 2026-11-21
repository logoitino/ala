/** UX-13 readable shared type preserves every action and required notice.
 * Explanatory copy that starts clamped with a "More" / "Less" toggle, so panels stay short and the full message is
 * one tap away (owner 2026-10-21: maximize screen for content). Never use it for policy, money, safety, consent or
 * rights text — those must stay fully visible (COMPLIANCE_*, held notice, 90 / 10, age gate, medical disclaimer).
 * Screen readers always get the full text. The toggle shows only when the text is long enough to need it; web
 * cannot report wrapped line counts, so the threshold is a character budget per line.
 */

import { useState } from 'react';
import { StyleSheet, Text, View, type StyleProp, type TextStyle } from 'react-native';

import { HapticPressable as Pressable } from '@/components/UI/HapticPressable';
import { FOCAL } from '@/theme/motion';
import { TYPE, figtree } from '@/theme/fonts';

/** Rough characters that fit one compact line on a 390pt phone. */
const CHARS_PER_LINE = 44;

type MoreTextProps = {
  children: string;
  /** Lines shown while collapsed. */
  lines?: number;
  style?: StyleProp<TextStyle>;
  /** Link ink; defaults to brand jade. */
  linkColor?: string;
};

/**
 * @purpose Clamp long explanatory text to a few lines with an accessible More / Less toggle.
 * @returns The text, plus a toggle when it is longer than `lines` compact lines.
 */
export function MoreText({ children, lines = 2, style, linkColor = FOCAL.jadeInk }: MoreTextProps) {
  const [open, setOpen] = useState(false);
  const text = children.trim();
  const long = text.length > lines * CHARS_PER_LINE;
  if (!long) return <Text style={style}>{text}</Text>;
  return (
    <View style={styles.wrap}>
      <Text style={style} numberOfLines={open ? undefined : lines} accessibilityLabel={text}>
        {text}
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={open ? 'Show less' : 'Show more'}
        accessibilityState={{ expanded: open }}
        haptic="selection"
        hitSlop={12}
        onPress={() => setOpen((value) => !value)}
        style={styles.toggle}
      >
        <Text style={[styles.toggleLabel, { color: linkColor }]}>{open ? 'Less' : 'More'}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: 2,
  },
  toggle: { minHeight: 44,
    alignSelf: 'flex-start',
    paddingVertical: 2,
  },
  toggleLabel: {
    ...TYPE.caption,
    ...figtree('800'),
  },
});

/**
 * Upfront upload limits for the Highlight composer (UPLOAD-STUDIO-01). Before this, a too-long or too-big clip was
 * only explained after the pick or at Publish. Values come from the same constants the picker and the Storage guard
 * enforce, so the chips can never promise more than the upload accepts. Presentation only.
 */
import { StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';

import { colors, radii } from '@/constants/theme';
import { PHOTO_STORY_MAX_PHOTOS, type HighlightMediaType } from '@/data/highlights';
import { HIGHLIGHT_MAX_MB, HIGHLIGHT_MAX_SECONDS } from '@/data/media';
import { TYPE, figtree } from '@/theme/fonts';
import { FOCAL } from '@/theme/motion';

type Chip = { icon: keyof typeof Ionicons.glyphMap; text: string; spoken: string };

/** @purpose The three limit facts for one media kind, with a spoken form for screen readers. */
export function uploadLimits(kind: HighlightMediaType): Chip[] {
  if (kind === 'photo_story') {
    return [
      { icon: 'images-outline', text: `Up to ${PHOTO_STORY_MAX_PHOTOS} photos`, spoken: `up to ${PHOTO_STORY_MAX_PHOTOS} photos` },
      { icon: 'swap-vertical-outline', text: 'Set the order', spoken: 'you set the order' },
      { icon: 'earth-outline', text: 'Public story', spoken: 'photo stories are public' },
    ];
  }
  return [
    { icon: 'timer-outline', text: `Up to ${HIGHLIGHT_MAX_SECONDS}s`, spoken: `up to ${HIGHLIGHT_MAX_SECONDS} seconds` },
    { icon: 'cloud-upload-outline', text: `Under ${HIGHLIGHT_MAX_MB} MB`, spoken: `under ${HIGHLIGHT_MAX_MB} megabytes` },
    { icon: 'phone-portrait-outline', text: 'Vertical looks best', spoken: 'vertical video looks best' },
  ];
}

/** @purpose Show the upload limits as a single readable row of chips that wraps on narrow phones. */
export function UploadLimitChips({ kind }: { kind: HighlightMediaType }) {
  const chips = uploadLimits(kind);
  return (
    <View accessible accessibilityLabel={`Limits: ${chips.map((chip) => chip.spoken).join(', ')}.`} style={styles.row}>
      {chips.map((chip) => (
        <View key={chip.text} style={styles.chip}>
          <Ionicons name={chip.icon} size={13} color={FOCAL.jadeInk} />
          <Text style={styles.text}>{chip.text}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 6 },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 9, paddingVertical: 4,
    borderRadius: radii.pill, backgroundColor: FOCAL.mistJade, borderWidth: 1, borderColor: colors.border,
  },
  text: { ...figtree('700'), ...TYPE.caption, color: FOCAL.jadeInk },
});

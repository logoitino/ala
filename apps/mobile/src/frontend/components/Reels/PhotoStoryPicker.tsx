/**
 * Photo-story pieces of the Highlight composer (PHOTO_STORIES_DESIGN.md "Screens: Upload"): the Video | Photos
 * switch, the thumbnail strip with Move earlier / Move later / Remove, and the optional per-photo descriptions.
 * Presentation only — the draft lives in UploadVideoModal and the steps in UploadVideoComposer.
 * Reordering uses buttons, not drag, so it works with VoiceOver / TalkBack: every control is a 44-point target
 * whose spoken label names the photo's position ("Move photo 2 earlier").
 * UX-13 aligns existing readable type and wrapping without changing any action or notice.
 */
import { Image, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { HapticPressable as Pressable } from '@/components/UI/HapticPressable';
import { colors, MENU_METRICS, radii } from '@/constants/theme';
import { PHOTO_DESCRIPTION_MAX, PHOTO_STORY_MAX_PHOTOS, type HighlightMediaType } from '@/data/highlights';
import { TYPE, figtree } from '@/theme/fonts';

/** A picked photo in the draft. `key` is stable across reorders so inputs keep focus and text. */
export type DraftStoryPhoto = { key: string; uri: string; width?: number; height?: number; description?: string };

const KINDS: { id: HighlightMediaType; label: string; icon: 'videocam-outline' | 'images-outline' }[] = [
  { id: 'video', label: 'Video', icon: 'videocam-outline' },
  { id: 'photo_story', label: 'Photos', icon: 'images-outline' },
];

/** @purpose Segmented Video | Photos choice on the Media step. Shown only when photo stories are available. */
export function MediaKindSwitch({ value, onChange, disabled }: {
  value: HighlightMediaType; onChange: (kind: HighlightMediaType) => void; disabled?: boolean;
}) {
  return (
    <View accessibilityRole="tablist" style={styles.segment}>
      {KINDS.map((kind) => {
        const selected = kind.id === value;
        return (
          <Pressable key={kind.id} accessibilityRole="tab" accessibilityLabel={kind.label}
            accessibilityState={{ selected, disabled }} disabled={disabled} onPress={() => onChange(kind.id)}
            style={[styles.segmentItem, selected && styles.segmentActive]}>
            <Ionicons name={kind.icon} size={18} color={selected ? colors.primary : colors.textMuted} />
            <Text style={[styles.segmentText, selected && styles.segmentTextActive]}>{kind.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function IconButton({ icon, label, disabled, onPress }: {
  icon: 'chevron-back' | 'chevron-forward' | 'trash-outline'; label: string; disabled?: boolean; onPress: () => void;
}) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled }}
      disabled={disabled} onPress={onPress} style={[styles.iconButton, disabled && styles.dim]}>
      <Ionicons name={icon} size={20} color={icon === 'trash-outline' ? colors.danger : colors.primary} />
    </Pressable>
  );
}

/**
 * @purpose Ordered thumbnails for the story with reorder/remove controls and an Add photos button.
 * @param photos Draft photos in story order; the first is the cover.
 * @param onMove Move a photo from one index to another (the controller applies `movePhoto`).
 * @param onRemove Drop a photo from the draft.
 * @param onAdd Open the picker for the remaining slots.
 */
export function PhotoStoryStrip({ photos, onMove, onRemove, onAdd, disabled }: {
  photos: DraftStoryPhoto[]; onMove: (from: number, to: number) => void; onRemove: (index: number) => void;
  onAdd: () => void; disabled?: boolean;
}) {
  const total = photos.length;
  return (
    <View style={styles.field}>
      <View style={styles.row}>
        <Text style={[styles.label, styles.flex]}>{total} of {PHOTO_STORY_MAX_PHOTOS} photos</Text>
        {total < PHOTO_STORY_MAX_PHOTOS ? (
          <Pressable accessibilityRole="button" accessibilityLabel="Add photos" disabled={disabled} onPress={onAdd} style={styles.smallButton}>
            <Text style={styles.link}>Add photos</Text>
          </Pressable>
        ) : null}
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.strip} keyboardShouldPersistTaps="handled">
        {photos.map((photo, index) => {
          const n = index + 1;
          return (
            <View key={photo.key} style={styles.tile}>
              <Image source={{ uri: photo.uri }} style={styles.tileImage} resizeMode="cover"
                accessibilityLabel={`Photo ${n} of ${total}${index === 0 ? ', cover' : ''}`} />
              <View style={styles.badge}><Text style={styles.badgeText}>{n}</Text></View>
              <View style={styles.row}>
                <IconButton icon="chevron-back" label={`Move photo ${n} earlier`} disabled={disabled || index === 0} onPress={() => onMove(index, index - 1)} />
                <IconButton icon="chevron-forward" label={`Move photo ${n} later`} disabled={disabled || index === total - 1} onPress={() => onMove(index, index + 1)} />
                <IconButton icon="trash-outline" label={`Remove photo ${n}`} disabled={disabled} onPress={() => onRemove(index)} />
              </View>
            </View>
          );
        })}
      </ScrollView>
      <Text style={styles.hint}>The first photo is the cover. Use the arrows to change the order.</Text>
    </View>
  );
}

/**
 * @purpose Optional description for each photo (≤ 200 characters, `reel_photos.description`), shown above the
 *   caption when that photo is on screen in the feed.
 */
export function PhotoDescriptionFields({ photos, onDescription, disabled }: {
  photos: DraftStoryPhoto[]; onDescription: (index: number, text: string) => void; disabled?: boolean;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>Photo descriptions (optional)</Text>
      {photos.map((photo, index) => {
        const text = photo.description ?? '';
        return (
          <View key={photo.key} style={styles.descriptionRow}>
            <Image source={{ uri: photo.uri }} style={styles.descriptionThumb} resizeMode="cover" accessible={false} />
            <View style={styles.flex}>
              <TextInput accessibilityLabel={`Description for photo ${index + 1}`} value={text} editable={!disabled}
                onChangeText={(next) => onDescription(index, next)} maxLength={PHOTO_DESCRIPTION_MAX} multiline
                placeholder={`Photo ${index + 1}: what is happening here?`} placeholderTextColor={colors.textMuted} style={styles.input} />
              <Text style={styles.counter}>{text.length}/{PHOTO_DESCRIPTION_MAX}</Text>
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  row: { flexDirection: 'row', alignItems: 'center' },
  field: { gap: 8 },
  label: { ...TYPE.button, ...figtree('800'), color: colors.text },
  hint: { ...figtree('400'), ...TYPE.caption,  color: colors.textMuted },
  link: { ...TYPE.caption,  ...figtree('800'), color: colors.primary },
  smallButton: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 6 },
  segment: { flexDirection: 'row', gap: 6, padding: 4, borderRadius: radii.pill, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  segmentItem: { flex: 1, minHeight: 44, flexDirection: 'row', gap: 6, alignItems: 'center', justifyContent: 'center', borderRadius: radii.pill },
  segmentActive: { backgroundColor: colors.accentSoft },
  segmentText: { ...TYPE.body, ...figtree('700'), color: colors.textMuted },
  segmentTextActive: { color: colors.primary },
  strip: { gap: 10, paddingVertical: 2 },
  tile: { width: 132, gap: 4, padding: 0, borderRadius: MENU_METRICS.controlRadius, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, overflow: 'hidden' },
  tileImage: { width: 132, height: 132, backgroundColor: colors.photoPlaceholder },
  badge: { position: 'absolute', top: 6, left: 6, minWidth: 24, minHeight: 24, paddingHorizontal: 6, paddingVertical: 3, borderRadius: 12, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  badgeText: { color: colors.onAccent, ...TYPE.caption, ...figtree('800') },
  iconButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  dim: { opacity: 0.35 },
  descriptionRow: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  descriptionThumb: { width: 48, height: 64, borderRadius: 8, backgroundColor: colors.photoPlaceholder },
  input: { ...figtree('400'), minHeight: 48, borderWidth: 1, borderColor: colors.border, borderRadius: MENU_METRICS.controlRadius, paddingHorizontal: 12, paddingTop: 12, backgroundColor: colors.surface, color: colors.text, ...TYPE.body, textAlignVertical: 'top' },
  counter: { ...figtree('400'), ...TYPE.caption, textAlign: 'right', color: colors.textMuted, marginTop: 4 },
});

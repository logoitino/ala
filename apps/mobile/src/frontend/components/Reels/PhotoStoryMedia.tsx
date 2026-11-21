/**
 * The media area of a Highlights photo story (PHOTO_STORIES_DESIGN.md, "Screens: Feed"). `ReelCard` renders
 * this instead of the video player when `isPhotoStory(clip)`; the rail, donate, report and credit stay in
 * the card. Photos page horizontally inside the vertical feed pager, with a `2 / 5` counter and dots.
 * Uses React Native `Image` (expo-image is not installed). Screen readers change photos with the adjustable
 * increment / decrement actions; web gets Previous / Next buttons because a mouse cannot swipe a pager.
 * @sideEffects `useStoryPhotos` (reads `reel_photos_feed` while `active`).
 * UX-13 aligns existing readable type and wrapping without changing any action or notice.
 */

import Ionicons from '@expo/vector-icons/Ionicons';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Platform,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
  type AccessibilityActionEvent,
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { FlatList } from 'react-native-gesture-handler';
import { useReducedMotion } from 'react-native-reanimated';

import { HapticPressable as Pressable } from '@/components/UI/HapticPressable';
import { colors, radii } from '@/constants/theme';
import type { HighlightClip, StoryPhoto } from '@/data/highlights';
import { useStoryPhotos } from '@/hooks/useStoryPhotos';
import { FOCAL } from '@/theme/motion';
import { TYPE, figtree } from '@/theme/fonts';

export type PhotoStoryMediaProps = {
  clip: HighlightClip;
  /** True while this card is the current page: fetch photos and report the current one. */
  active: boolean;
  /** Distance from the top of the card to clear the feed header before the counter chip. */
  topInset?: number;
  /** Current photo changed (or loaded). `photo` is null while only the cover is shown. */
  onPhotoChange?: (photo: StoryPhoto | null, index: number, total: number) => void;
  /** A photo or the cover actually finished loading. The card counts a view only after this. */
  onContentReady?: () => void;
};

/** Screen-reader / alt text for one photo: its description, else its place in the story. */
export function storyPhotoLabel(photo: Pick<StoryPhoto, 'description'> | null, index: number, total: number): string {
  const description = photo?.description?.trim();
  if (description) return description;
  return `Photo ${index + 1} of ${total}`;
}

/**
 * @purpose Swipeable photos for one story, falling back to `clip.coverUrl` while loading, when the photo
 *   list is empty (SQL missing) or when the fetch fails.
 * @param clip Photo-story clip (`mediaType = 'photo_story'`).
 * @param active Fetch and report only for the current card; an off-screen mounted card stays idle.
 * @returns Full-bleed pager with counter chip and dots (both hidden for a single photo).
 * @sideEffects `useStoryPhotos`.
 */
export function PhotoStoryMedia({ clip, active, topInset = 0, onPhotoChange, onContentReady }: PhotoStoryMediaProps) {
  const screenSize = useWindowDimensions();
  const reduceMotion = useReducedMotion();
  const { photos, loading, error } = useStoryPhotos(clip, active);
  const listRef = useRef<FlatList<StoryPhoto>>(null);
  const [size, setSize] = useState({ width: screenSize.width, height: 0 });
  const [index, setIndex] = useState(0);
  const [failed, setFailed] = useState<Record<string, true>>({});
  const total = photos.length;
  const multi = total > 1;
  const current = total > 0 ? photos[Math.min(index, total - 1)] ?? null : null;
  const coverUrl = clip.coverUrl?.trim() || null;

  // New story in a recycled card: start at its first photo.
  useEffect(() => {
    setIndex(0);
    setFailed({});
    listRef.current?.scrollToOffset({ offset: 0, animated: false });
  }, [clip.id]);

  useEffect(() => {
    if (index > 0 && index >= total) setIndex(Math.max(0, total - 1));
  }, [index, total]);

  useEffect(() => {
    if (!active) return;
    onPhotoChange?.(current, current ? Math.min(index, total - 1) : 0, total);
  }, [active, current, index, onPhotoChange, total]);

  const goTo = useCallback(
    (next: number) => {
      if (total === 0) return;
      const target = Math.max(0, Math.min(total - 1, next));
      setIndex(target);
      // Programmatic moves (screen reader, web buttons) jump instead of sliding when Reduce Motion is on.
      listRef.current?.scrollToOffset({ offset: target * size.width, animated: !reduceMotion });
    },
    [reduceMotion, size.width, total],
  );

  const onLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    if (width === size.width && height === size.height) return;
    setSize({ width, height });
    // Rotation / split view: keep the same photo under the finger after the page width changes.
    if (width > 0) listRef.current?.scrollToOffset({ offset: index * width, animated: false });
  };

  // Momentum-end alone is not enough: react-native-web may never fire it, which left the counter, dots
  // and Prev / Next on the old photo. Throttled scroll events keep them in step on every platform.
  const syncIndexFromScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (size.width <= 0 || total === 0) return;
    const next = Math.max(0, Math.min(total - 1, Math.round(event.nativeEvent.contentOffset.x / size.width)));
    setIndex((current) => (current === next ? current : next));
  };

  const onAccessibilityAction = (event: AccessibilityActionEvent) => {
    if (event.nativeEvent.actionName === 'increment') goTo(index + 1);
    if (event.nativeEvent.actionName === 'decrement') goTo(index - 1);
  };

  const pageStyle = useMemo(() => ({ width: size.width, height: '100%' as const }), [size.width]);

  const renderPhoto = ({ item, index: at }: { item: StoryPhoto; index: number }) => (
    <View style={pageStyle}>
      {failed[item.id] ? (
        <View style={styles.missing} accessibilityLabel={storyPhotoLabel(item, at, total)} accessible>
          <Ionicons name="image-outline" size={36} color={colors.onVideoMuted} />
          <Text style={styles.missingLabel}>This photo didn&apos;t load</Text>
        </View>
      ) : (
        <Image
          source={{ uri: item.imageUrl }}
          resizeMode="cover"
          style={styles.fill}
          accessible
          accessibilityIgnoresInvertColors
          accessibilityLabel={storyPhotoLabel(item, at, total)}
          onLoad={onContentReady}
          onError={() => setFailed((map) => ({ ...map, [item.id]: true }))}
        />
      )}
    </View>
  );

  if (total === 0) {
    return (
      <View style={styles.root} onLayout={onLayout} testID="photo-story-fallback">
        {coverUrl ? (
          <Image
            source={{ uri: coverUrl }}
            resizeMode="cover"
            style={styles.fill}
            accessible
            accessibilityIgnoresInvertColors
            accessibilityLabel={`Photo story cover, ${clip.tag}`}
            onLoad={onContentReady}
          />
        ) : (
          <View style={styles.missing}>
            <Ionicons name="images-outline" size={40} color={colors.onVideoMuted} />
            {!loading ? <Text style={styles.missingLabel}>Photos aren&apos;t available right now</Text> : null}
          </View>
        )}
        {loading ? (
          <View style={styles.loading} pointerEvents="none">
            <ActivityIndicator color={FOCAL.neonJade} accessibilityLabel="Loading photos" />
          </View>
        ) : null}
        {error && coverUrl ? (
          <View style={[styles.notice, { top: topInset + 8 }]} pointerEvents="none">
            <Text style={styles.noticeLabel}>Showing the cover photo</Text>
          </View>
        ) : null}
      </View>
    );
  }

  const position = Math.min(index, total - 1);
  const currentLabel = storyPhotoLabel(current, position, total);

  return (
    <View style={styles.root} onLayout={onLayout} testID="photo-story">
      <View
        style={styles.fill}
        accessible
        accessibilityRole={multi ? 'adjustable' : 'image'}
        accessibilityLabel={multi ? `Photo story, ${total} photos` : currentLabel}
        accessibilityValue={
          multi
            ? { text: current?.description?.trim() ? `${currentLabel}, photo ${position + 1} of ${total}` : currentLabel }
            : undefined
        }
        accessibilityHint={multi ? 'Swipe up or down to change photo' : undefined}
        accessibilityActions={multi ? [{ name: 'increment' }, { name: 'decrement' }] : undefined}
        onAccessibilityAction={multi ? onAccessibilityAction : undefined}
      >
        <FlatList
          ref={listRef}
          data={photos}
          keyExtractor={(item) => item.id}
          renderItem={renderPhoto}
          horizontal
          pagingEnabled
          bounces={false}
          showsHorizontalScrollIndicator={false}
          scrollEnabled={multi}
          testID="photo-story-pager"
          onScroll={syncIndexFromScroll}
          scrollEventThrottle={64}
          onMomentumScrollEnd={syncIndexFromScroll}
          getItemLayout={(_data, at) => ({ length: size.width, offset: size.width * at, index: at })}
          // Full-resolution photos are heavy: keep only the current and adjacent pages decoded.
          initialNumToRender={1}
          maxToRenderPerBatch={1}
          windowSize={3}
          removeClippedSubviews={Platform.OS === 'android'}
          extraData={`${size.width}:${Object.keys(failed).join(',')}`}
        />
      </View>

      {multi ? (
        <View
          pointerEvents="none"
          style={[styles.indicators, { top: topInset + 8 }]}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        >
          <View style={styles.counter}>
            <Text style={styles.counterLabel}>{`${position + 1} / ${total}`}</Text>
          </View>
          <View style={styles.dots} testID="photo-story-dots">
            {photos.map((photo, at) => (
              <View key={photo.id} style={[styles.dot, at === position && styles.dotActive]} />
            ))}
          </View>
        </View>
      ) : null}

      {multi && Platform.OS === 'web' ? (
        <>
          {position > 0 ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Previous photo"
              onPress={() => goTo(position - 1)}
              style={({ pressed }) => [styles.stepBtn, styles.stepLeft, pressed && styles.pressed]}
            >
              <Ionicons name="chevron-back" size={22} color={colors.onVideo} />
            </Pressable>
          ) : null}
          {position < total - 1 ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Next photo"
              onPress={() => goTo(position + 1)}
              style={({ pressed }) => [styles.stepBtn, styles.stepRight, pressed && styles.pressed]}
            >
              <Ionicons name="chevron-forward" size={22} color={colors.onVideo} />
            </Pressable>
          ) : null}
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFill,
    backgroundColor: colors.night,
  },
  fill: {
    ...StyleSheet.absoluteFill,
  },
  loading: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  missing: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 24,
    backgroundColor: colors.videoSurface,
  },
  missingLabel: {
    color: colors.onVideoMuted,
    ...TYPE.button,
    ...figtree('700'),
    textAlign: 'center',
  },
  notice: {
    position: 'absolute',
    right: 12,
    backgroundColor: colors.videoScrimSoft,
    borderRadius: radii.pill,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  noticeLabel: {
    color: colors.onVideo,
    ...TYPE.caption,
    ...figtree('800'),
  },
  // Top-right keeps the chip clear of the category / Flash chips (top-left) and the bottom copy + rail.
  indicators: {
    position: 'absolute',
    right: 12,
    alignItems: 'flex-end',
    gap: 6,
    zIndex: 2,
  },
  counter: {
    backgroundColor: colors.videoScrim,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: 'rgba(243,251,247,0.35)',
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  counterLabel: {
    color: colors.onVideo,
    ...TYPE.caption,
    ...figtree('800'),
    letterSpacing: 0.4,
    fontVariant: ['tabular-nums'],
  },
  dots: {
    flexDirection: 'row',
    gap: 4,
    paddingHorizontal: 6,
    paddingVertical: 4,
    borderRadius: radii.pill,
    backgroundColor: colors.videoScrimSoft,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(243,251,247,0.45)',
  },
  dotActive: {
    width: 14,
    backgroundColor: FOCAL.neonJade,
  },
  stepBtn: {
    position: 'absolute',
    top: '50%',
    marginTop: -22,
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.videoScrimSoft,
    zIndex: 4,
  },
  stepLeft: {
    left: 8,
  },
  stepRight: {
    // Right edge holds the hype rail lower down; the vertical centre stays clear of it on phones.
    right: 8,
  },
  pressed: {
    opacity: 0.8,
  },
});

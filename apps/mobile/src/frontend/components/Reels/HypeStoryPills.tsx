/**
 * Seki and Flex story on a Highlight and on a profile. On a video the full line pops in, then
 * tucks into icons above the caption so the clip stays visible. An arrow brings the line back.
 * UX-13 aligns existing readable type and wrapping without changing any action or notice.
 */

import { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useReducedMotion } from 'react-native-reanimated';

import { SheetRise } from '@/components/UI/SheetRise';
import { HapticPressable as Pressable } from '@/components/UI/HapticPressable';
import type { HypeStory } from '@/data/hypeStory';
import { FOCAL } from '@/theme/motion';
import { TYPE, figtree } from '@/theme/fonts';

/** How long the video story stays open before it tucks into icons. */
const VIDEO_STORY_OPEN_MS = 1600;

type HypeStoryPillsProps = {
  stories: HypeStory[];
  /** Video chrome is light-on-dark and collapses. A profile card is Daylight and stays open. */
  tone: 'video' | 'daylight';
};

/**
 * @purpose Draw the eye to a Seki play or to the people riding with an athlete, then give the video back.
 * @param stories Lines from `hypeStories`. Nothing renders when the list is empty.
 * @param tone Video overlay collapses to icons. Daylight stays as the full line.
 * @returns A rising story, or a row of icons with an arrow.
 * @sideEffects A timer closes the video story. Reduced motion starts on the icons.
 */
export function HypeStoryPills({ stories, tone }: HypeStoryPillsProps) {
  const reduce = useReducedMotion();
  const onVideo = tone === 'video';
  const storyKey = stories.map((story) => story.id).join(',');
  const [open, setOpen] = useState(!onVideo || !reduce);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!onVideo) return undefined;
    if (timer.current) clearTimeout(timer.current);
    if (reduce) {
      setOpen(false);
      return undefined;
    }
    setOpen(true);
    timer.current = setTimeout(() => setOpen(false), VIDEO_STORY_OPEN_MS);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [onVideo, reduce, storyKey]);

  if (stories.length === 0) return null;

  const show = () => {
    if (timer.current) clearTimeout(timer.current);
    setOpen(true);
  };
  const hide = () => {
    if (timer.current) clearTimeout(timer.current);
    setOpen(false);
  };

  if (onVideo && !open) {
    return (
      <View style={styles.iconRow}>
        {stories.map((story) => (
          <Pressable
            key={story.id}
            testID={`hype-story-${story.id}`}
            accessibilityLabel={`${story.line}. ${story.detail}. Show story`}
            haptic="selection"
            hitSlop={8}
            onPress={show}
            style={[styles.iconBtn, story.id === 'seki' ? styles.sekiVideo : styles.flexVideo]}
          >
            <Text style={styles.emoji}>{story.emoji}</Text>
          </Pressable>
        ))}
        <Pressable
          testID="hype-story-toggle"
          accessibilityLabel="Show the Seki and Flex story"
          haptic="selection"
          hitSlop={8}
          onPress={show}
          style={styles.arrowBtn}
        >
          <Ionicons name="chevron-up" size={18} color="#F3FBF7" />
        </Pressable>
      </View>
    );
  }

  const pills = (
    <View style={styles.row}>
      {stories.map((story) => {
        const seki = story.id === 'seki';
        return (
          <View
            key={story.id}
            testID={`hype-story-${story.id}`}
            accessibilityLabel={`${story.line}. ${story.detail}`}
            style={[
              styles.pill,
              onVideo
                ? seki
                  ? styles.sekiVideo
                  : styles.flexVideo
                : seki
                  ? styles.sekiDay
                  : styles.flexDay,
            ]}
          >
            <Text style={styles.emoji}>{story.emoji}</Text>
            <View style={styles.copy}>
              <Text style={[styles.line, onVideo ? styles.lineVideo : seki ? styles.lineSeki : styles.lineFlex]}>
                {story.line}
              </Text>
              <Text style={[styles.detail, onVideo ? styles.detailVideo : styles.detailDay]}>
                {story.detail}
              </Text>
            </View>
          </View>
        );
      })}
      {onVideo ? (
        <Pressable
          testID="hype-story-toggle"
          accessibilityLabel="Hide the story"
          haptic="selection"
          hitSlop={8}
          onPress={hide}
          style={styles.arrowBtn}
        >
          <Ionicons name="chevron-down" size={18} color="#F3FBF7" />
        </Pressable>
      ) : null}
    </View>
  );

  return onVideo ? <SheetRise>{pills}</SheetRise> : pills;
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  iconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    maxWidth: '100%',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
  },
  iconBtn: {
    minWidth: 44,
    minHeight: 44,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  arrowBtn: {
    minWidth: 44,
    minHeight: 44,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(15,20,22,0.45)',
  },
  sekiVideo: {
    backgroundColor: 'rgba(0,229,255,0.22)',
    borderColor: FOCAL.islandCyan,
  },
  flexVideo: {
    backgroundColor: 'rgba(255,215,0,0.22)',
    borderColor: FOCAL.electricGold,
  },
  sekiDay: {
    backgroundColor: FOCAL.mistCyan,
    borderColor: FOCAL.cyanInk,
  },
  flexDay: {
    backgroundColor: FOCAL.mistGold,
    borderColor: FOCAL.goldInk,
  },
  emoji: {
    fontSize: 16,
  },
  copy: {
    flexShrink: 1,
  },
  line: {
    ...TYPE.body,
    ...figtree('800'),
  },
  lineVideo: {
    color: '#F3FBF7',
  },
  lineSeki: {
    color: FOCAL.cyanInk,
  },
  lineFlex: {
    color: FOCAL.goldInk,
  },
  detail: {
    ...TYPE.caption,
    ...figtree('600'),
  },
  detailVideo: {
    color: 'rgba(243,251,247,0.88)',
  },
  detailDay: {
    color: FOCAL.ink,
  },
});

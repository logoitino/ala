/**
 * Horizontal pill row, generic over the pill id type, with optional counts. Used by the search overlays, the athlete
 * profile and the role switcher.
 */

import { useEffect, useRef } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';

import { AnimatedButton } from '@/components/UI/AnimatedButton';
import { colors } from '@/constants/theme';
import { FOCAL, SPRING_SHEET } from '@/theme/motion';

export type FilterPill<T extends string> = {
  id: T;
  label: string;
};

type FilterPillsProps<T extends string> = {
  items: FilterPill<T>[];
  value: T | null;
  onChange: (id: T | null) => void;
  allowDeselect?: boolean;
  accessibilityLabel?: string;
};


/**
 * @purpose Horizontal filter chips with a sliding indicator that `withSpring`s to the active pill. One chip style
 * everywhere (Calm Island, owner 2026-10-15): ink fill + white label when selected, white outlined pill when idle.
 * @param items Pill ids and labels.
 * @param value Currently selected id.
 * @param onChange Fires on press; `null` only when `allowDeselect`.
 * @sideEffects Selection haptic on each pill via `AnimatedButton`.
 */
export function FilterPills<T extends string>({
  items,
  value,
  onChange,
  allowDeselect = false,
  accessibilityLabel = 'Filters',
}: FilterPillsProps<T>) {
  const layouts = useRef<Partial<Record<string, { x: number; width: number }>>>({});
  const placed = useRef(false);
  const indicatorX = useSharedValue(0);
  const indicatorW = useSharedValue(0);
  const indicatorOp = useSharedValue(0);

  const moveIndicator = (id: string | null, animate: boolean) => {
    if (!id) {
      indicatorOp.value = withTiming(0, { duration: 120 });
      return;
    }
    const box = layouts.current[id];
    if (!box) return;
    if (!animate || !placed.current) {
      indicatorX.value = box.x;
      indicatorW.value = box.width;
      indicatorOp.value = 1;
      placed.current = true;
      return;
    }
    indicatorX.value = withSpring(box.x, SPRING_SHEET);
    indicatorW.value = withSpring(box.width, SPRING_SHEET);
    indicatorOp.value = withTiming(1, { duration: 120 });
  };

  const itemKey = items.map((item) => item.id).join('|');

  useEffect(() => {
    moveIndicator(value, true);
    // Layout boxes live in a ref; `itemKey` is the stable identity for this row.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, itemKey]);

  const indicatorStyle = useAnimatedStyle(() => ({
    opacity: indicatorOp.value,
    transform: [{ translateX: indicatorX.value }],
    width: indicatorW.value,
  }));

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.scroll}
      accessibilityRole="tablist"
      accessibilityLabel={accessibilityLabel}
    >
      <View style={styles.row}>
        <Animated.View
          pointerEvents="none"
          style={[styles.indicator, indicatorStyle]}
        />
        {items.map((item) => {
          const selected = value === item.id;
          return (
            <View
              key={item.id}
              style={styles.pillWrap}
              onLayout={(event) => {
                const { x, width } = event.nativeEvent.layout;
                layouts.current[item.id] = { x, width };
                if (selected) moveIndicator(item.id, placed.current);
              }}
            >
              <AnimatedButton
                haptic="selection"
                accessibilityRole="tab"
                accessibilityLabel={item.label}
                accessibilityState={{ selected }}
                onPress={() => {
                  if (allowDeselect && selected) onChange(null);
                  else onChange(item.id);
                }}
                contentStyle={[
                  styles.pill,
                  selected ? styles.pillOn : styles.pillIdle,
                ]}
              >
                <Text style={[styles.label, selected && styles.labelOn]}>{item.label}</Text>
              </AnimatedButton>
            </View>
          );
        })}
      </View>
      <View style={styles.tail} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingRight: 4,
    minHeight: 44,
  },
  row: {
    position: 'relative',
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    minHeight: 44,
  },
  pillWrap: {
    alignSelf: 'flex-start',
  },
  indicator: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    zIndex: 0,
    borderRadius: 999,
    backgroundColor: FOCAL.ink,
  },
  pill: {
    minHeight: 44,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    zIndex: 1,
  },
  pillOn: {
    backgroundColor: 'transparent',
    borderColor: 'transparent',
  },
  pillIdle: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
  },
  label: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.text,
  },
  labelOn: {
    color: colors.onAccent,
  },
  tail: {
    width: 2,
  },
});

import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Extrapolation,
  cancelAnimation,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';

import { ReelOwnerPeek } from '@/components/Reels/ReelOwnerPeek';
import { colors, MENU_METRICS } from '@/constants/theme';
import type { HighlightClip } from '@/data/highlights';
import type { Player } from '@/data/players';
import { canDropMaloOnHighlight } from '@/data/malo';
import type { UsageSurface } from '@/hooks/useSurfaceUsage';
import { clampPeekOffset, markPeekHintSeen, peekPanelWidth, readPeekHintSeen, resolvePeekSnap, type PeekSide } from '@/lib/reels';
import { telemetry } from '@/services/TelemetryManager';
import { FOCAL, REEL_DEPTH, SPRING_PEEK } from '@/theme/motion';

/** Video slides this fraction of the panel travel (parallax). */
const VIDEO_SHIFT = 0.32;
const HINT_PAGES = 3;

let hintSeenCache: boolean | null = null;

function usePeekHint(active: boolean, index: number) {
  const [seen, setSeen] = useState<boolean>(hintSeenCache ?? true);

  useEffect(() => {
    if (hintSeenCache != null) {
      setSeen(hintSeenCache);
      return;
    }
    let live = true;
    void readPeekHintSeen().then((value) => {
      hintSeenCache = value;
      if (live) setSeen(value);
    });
    return () => {
      live = false;
    };
  }, []);

  const dismiss = useCallback(() => {
    if (hintSeenCache) return;
    hintSeenCache = true;
    setSeen(true);
    void markPeekHintSeen();
  }, []);

  const show = active && !seen && index < HINT_PAGES;
  return useMemo(() => ({ show, dismiss }), [show, dismiss]);
}

/** Room for the clip's own chips (Flash Unlock, coach level, Train / Serve) stacked under the header. */
const HINT_CHIP_CLEARANCE = 104;

/**
 * @purpose Vertical position of the "Swipe for the athlete" hint: mid-clip, but never over the chips that sit
 * just under the floating header, and never down into the caption block.
 * @param height Page height. @param insetTop Header clearance passed as `peekInsetTop`.
 * @returns The top offset, or null on a screen too short to fit it between chips and caption (skip the hint).
 */
export function peekHintTop(height: number, insetTop: number): number | null {
  const top = Math.max(height * 0.46, insetTop + HINT_CHIP_CLEARANCE);
  return top <= height * 0.62 ? top : null;
}

export type ReelPageProps = {
  children: ReactNode;
  index: number;
  height: number;
  /** Pager offset from the parent `Animated.FlatList`. Omit to disable the depth effect (modal pager). */
  scrollY?: SharedValue<number>;
  active: boolean;
  clip: HighlightClip;
  player: Player | null;
  totalTipsCents: number;
  surface?: UsageSurface;
  /** Set false to disable the horizontal owner peek (e.g. while a sheet is up). */
  peekEnabled?: boolean;
  /** Space reserved above the peek panel so it clears floating chrome (Highlights header). Default 56. */
  peekInsetTop?: number;
  /** Space reserved below the peek panel (caption block, rail bottom). Default 56. */
  peekInsetBottom?: number;
  onOpenProfile?: () => void;
  onTip?: () => void;
  /** Fires when the peek opens or closes so the parent can pause other gestures. */
  onPeekChange?: (open: boolean) => void;
};

/**
 * @purpose One page of the Highlights pager. Adds two motion layers around `ReelCard` (a video or a photo story; the
 * peek is the same for both): (1) card-deck depth —
 * the outgoing page shrinks, sinks, rounds its corners and dims while the incoming page scales up with a slight
 * tilt; (2) swipe left or right on the clip to slide in `ReelOwnerPeek` from that edge while the video parallaxes
 * and dims behind it. Vertical paging, single-tap mute and double-tap Aura keep working (the pan only activates on
 * clear horizontal travel).
 * @param scrollY Shared pager offset; the depth math is `(scrollY - index * height) / height`.
 * @param active Closes the peek when the page leaves the viewport and gates the first-run swipe hint.
 * @returns Animated page with the peek panel and a one-time “swipe for profile” hint on the first pages.
 * @sideEffects Selection haptic when the drag crosses the open threshold, Medium on snap open; AsyncStorage hint flag; `TelemetryManager` `peek.open` / `peek.close`.
 */
export function ReelPage({
  children,
  index,
  height,
  scrollY,
  active,
  clip,
  player,
  totalTipsCents,
  surface = 'home',
  peekEnabled = true,
  peekInsetTop = 56,
  peekInsetBottom = 56,
  onOpenProfile,
  onTip,
  onPeekChange,
}: ReelPageProps) {
  const reduceMotion = useReducedMotion();
  const [width, setWidth] = useState(0);
  const [open, setOpen] = useState<PeekSide>(0);
  const hint = usePeekHint(active, index);
  const hintTop = peekHintTop(height, peekInsetTop);
  const pageWidth = useSharedValue(0);
  const peekX = useSharedValue(0);
  const side = useSharedValue<PeekSide>(0);
  const crossed = useSharedValue(false);
  const hintX = useSharedValue(0);
  const maloReady = canDropMaloOnHighlight(clip, player);

  const settle = useCallback(
    (next: PeekSide) => {
      setOpen(next);
      onPeekChange?.(next !== 0);
      if (next !== 0) {
        telemetry.trackFeature('peek.open', surface);
        hint.dismiss();
        try {
          void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        } catch {
          // Simulator / web may not expose haptics.
        }
      } else {
        telemetry.trackFeature('peek.close', surface);
      }
    },
    [hint, onPeekChange, surface],
  );

  const tickHaptic = useCallback(() => {
    try {
      void Haptics.selectionAsync();
    } catch {
      // Simulator / web may not expose haptics.
    }
  }, []);

  const close = useCallback(() => {
    if (side.value === 0) return;
    side.value = 0;
    peekX.value = withSpring(0, SPRING_PEEK);
    settle(0);
  }, [peekX, settle, side]);

  useEffect(() => {
    if (!active && side.value !== 0) close();
  }, [active, close, side]);

  useEffect(() => {
    if (!hint.show || reduceMotion) {
      cancelAnimation(hintX);
      hintX.value = 0;
      return;
    }
    hintX.value = withRepeat(
      withSequence(withTiming(-10, { duration: 520 }), withTiming(0, { duration: 520 }), withTiming(0, { duration: 700 })),
      -1,
      false,
    );
    return () => cancelAnimation(hintX);
  }, [hint.show, hintX, reduceMotion]);

  const onLayout = (event: LayoutChangeEvent) => {
    const next = event.nativeEvent.layout.width;
    setWidth(next);
    pageWidth.value = next;
  };

  const pan = Gesture.Pan()
    .enabled(peekEnabled && width > 0)
    .activeOffsetX([-18, 18])
    .failOffsetY([-14, 14])
    .onStart(() => {
      crossed.value = false;
    })
    .onUpdate((event) => {
      const panel = peekPanelWidth(pageWidth.value);
      const base = side.value * panel;
      const next = clampPeekOffset(base, event.translationX, panel);
      peekX.value = next;
      const wouldOpen = resolvePeekSnap(event.translationX, 0, pageWidth.value, side.value);
      const nowCrossed = wouldOpen !== side.value;
      if (nowCrossed !== crossed.value) {
        crossed.value = nowCrossed;
        runOnJS(tickHaptic)();
      }
    })
    .onEnd((event) => {
      const panel = peekPanelWidth(pageWidth.value);
      const target = resolvePeekSnap(event.translationX, event.velocityX, pageWidth.value, side.value);
      const changed = target !== side.value;
      side.value = target;
      peekX.value = withSpring(target * panel, SPRING_PEEK);
      if (changed) runOnJS(settle)(target);
    });

  const depthStyle = useAnimatedStyle(() => {
    if (!scrollY || height <= 0 || reduceMotion) return {};
    const position = (scrollY.value - index * height) / height;
    // position > 0: this page is scrolling up and out; < 0: it is arriving from below.
    const out = interpolate(position, [0, 1], [0, 1], Extrapolation.CLAMP);
    const incoming = interpolate(position, [-1, 0], [1, 0], Extrapolation.CLAMP);
    const scale = out > 0 ? 1 - (1 - REEL_DEPTH.scaleOut) * out : 1 - (1 - REEL_DEPTH.scaleIn) * incoming;
    const radius = Math.max(out, incoming) * REEL_DEPTH.radius;
    return {
      opacity: 1 - (1 - REEL_DEPTH.fade) * out,
      borderRadius: radius,
      transform: [
        { perspective: 1000 },
        { translateY: out * height * REEL_DEPTH.sink },
        { rotateX: `${incoming * REEL_DEPTH.tiltDeg}deg` },
        { scale },
      ],
    };
  });

  const videoStyle = useAnimatedStyle(() => {
    const panel = Math.max(1, peekPanelWidth(pageWidth.value));
    const ratio = Math.min(1, Math.abs(peekX.value) / panel);
    return {
      transform: [{ translateX: peekX.value * VIDEO_SHIFT }, { scale: 1 - ratio * 0.04 }],
    };
  });

  const dimStyle = useAnimatedStyle(() => {
    const panel = Math.max(1, peekPanelWidth(pageWidth.value));
    return { opacity: Math.min(1, Math.abs(peekX.value) / panel) * 0.58 };
  });

  const panelStyle = useAnimatedStyle(() => {
    const panel = peekPanelWidth(pageWidth.value);
    const x = peekX.value;
    // Panel is laid out at left: -panel. Negative x brings it in from the right edge, positive from the left.
    const translateX = x < 0 ? pageWidth.value + panel + x : x;
    const ratio = panel > 0 ? Math.min(1, Math.abs(x) / panel) : 0;
    return {
      opacity: interpolate(ratio, [0, 0.15, 1], [0, 0.6, 1], Extrapolation.CLAMP),
      transform: [{ translateX }, { scale: 0.96 + 0.04 * ratio }],
    };
  });

  const hintStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: hintX.value }],
  }));

  const panelWidth = peekPanelWidth(width);

  return (
    <Animated.View style={[styles.page, { height }, depthStyle]} onLayout={onLayout}>
      <GestureDetector gesture={pan}>
        <View style={styles.fill}>
          {/* While the card is open the clip and its rail are inert (the dim layer blocks touches), so hide them from
              screen readers too; otherwise VoiceOver / TalkBack can swipe into controls the card is covering. */}
          <Animated.View
            accessibilityElementsHidden={open !== 0}
            importantForAccessibility={open !== 0 ? 'no-hide-descendants' : 'auto'}
            style={[styles.fill, videoStyle]}
          >
            {children}
          </Animated.View>

          {/* The scrim is a touch-only dismiss: the card has its own labelled Close button, so a screen reader would
              otherwise hear "Close profile peek" twice. Always hidden from assistive tech. */}
          <Animated.View
            pointerEvents={open ? 'auto' : 'none'}
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            aria-hidden
            style={[styles.dim, dimStyle]}
          >
            <Pressable style={styles.fill} onPress={close} />
          </Animated.View>

          {width > 0 ? (
            <Animated.View
              pointerEvents={open ? 'auto' : 'none'}
              accessibilityElementsHidden={!open}
              importantForAccessibility={open ? 'auto' : 'no-hide-descendants'}
              aria-hidden={!open}
              // iOS: treat the card as modal so VoiceOver ignores its siblings (this is the card's parent, so the flag
              // must sit here; on the inner ScrollView it had no siblings to hide).
              accessibilityViewIsModal={open !== 0}
              style={[
                styles.panel,
                { width: panelWidth, left: -panelWidth, marginTop: peekInsetTop, marginBottom: peekInsetBottom },
                panelStyle,
              ]}
            >
              <ReelOwnerPeek
                clip={clip}
                player={player}
                open={open !== 0}
                maloReady={maloReady}
                totalTipsCents={totalTipsCents}
                surface={surface}
                onOpenProfile={
                  onOpenProfile
                    ? () => {
                        telemetry.trackFeature('peek.profile', surface);
                        close();
                        onOpenProfile();
                      }
                    : undefined
                }
                onTip={
                  onTip
                    ? () => {
                        telemetry.trackFeature('peek.malo', surface);
                        close();
                        onTip();
                      }
                    : undefined
                }
                onClose={close}
              />
            </Animated.View>
          ) : null}

          {hint.show && open === 0 && hintTop !== null ? (
            <Animated.View pointerEvents="none" style={[styles.hint, { top: hintTop }, hintStyle]} accessibilityLiveRegion="polite">
              <Ionicons name="chevron-back" size={14} color={FOCAL.electricGold} />
              <Text style={styles.hintLabel}>Swipe for the athlete</Text>
              <Ionicons name="chevron-forward" size={14} color={FOCAL.electricGold} />
            </Animated.View>
          ) : null}
        </View>
      </GestureDetector>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  page: {
    width: '100%',
    overflow: 'hidden',
    backgroundColor: colors.night,
  },
  fill: {
    flex: 1,
  },
  dim: {
    ...StyleSheet.absoluteFill,
    backgroundColor: FOCAL.videoBase,
    zIndex: 20,
  },
  panel: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    zIndex: 21,
    // Island Daylight card (fully opaque, so no clip edge shows through as a seam); the dim layer behind it
    // carries the contrast. Radius is the shared sheet geometry. `ReelOwnerPeek` draws the tier-colored header.
    backgroundColor: FOCAL.backgroundBase,
    borderColor: 'rgba(15,20,22,0.08)',
    borderWidth: 1,
    borderRadius: MENU_METRICS.sheetRadius,
    overflow: 'hidden',
  },
  hint: {
    position: 'absolute',
    left: 16,
    right: 84,
    zIndex: 19,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: colors.videoScrim,
    borderWidth: 1,
    borderColor: 'rgba(255,215,0,0.45)',
  },
  hintLabel: {
    color: FOCAL.electricGold,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
});

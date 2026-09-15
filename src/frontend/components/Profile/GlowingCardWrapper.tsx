import { type ReactNode, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';

import { GLOW_INSET } from '@/components/Effects/glowTokens';
import { radii } from '@/constants/theme';

/** Canvas is this many px larger than the card so the sweep sits on the card edge and the blur isn't clipped. */
const GLOW_PAD = GLOW_INSET * 2;

type GlowingCardWrapperProps = {
  children: ReactNode;
  isWishlistFulfilled?: boolean;
  isAuraMaxed?: boolean;
};

type GlowBorderProps = {
  width: number;
  height: number;
  borderRadius: number;
  isAuraMaxed: boolean;
  wishlistFulfilled: boolean;
};

/**
 * Native: static Skia. Web: `LoadSkiaWeb` via `WithSkiaWeb` before the Canvas module is imported.
 */
function GlowBorder(props: GlowBorderProps) {
  if (Platform.OS === 'web') {
    const { WithSkiaWeb } = require('@shopify/react-native-skia/lib/module/web') as typeof import('@shopify/react-native-skia/lib/module/web');
    return (
      <WithSkiaWeb
        getComponent={() => import('@/components/Effects/GlowingNeonBorder')}
        componentProps={props}
        opts={{ locateFile: (file: string) => `/${file}` }}
        fallback={null}
      />
    );
  }

  const { GlowingNeonBorder } = require('@/components/Effects/GlowingNeonBorder') as typeof import('@/components/Effects/GlowingNeonBorder');
  return <GlowingNeonBorder {...props} />;
}

/**
 * @purpose Sit a Skia neon sweep behind the 3D Aura trading card when Celestial Prism is unlocked or Locker Room gear is funded.
 * @param children The flippable `AuraTradingCard` (or a Studio persona card).
 * @param isWishlistFulfilled At least one wishlist item is fully funded / equipped.
 * @param isAuraMaxed Aura tier 7 — Celestial Prism.
 * @returns Centered wrap; glow canvas is 32px larger than the measured card (16px per side) and does not steal taps.
 * @sideEffects Native Skia GPU canvas. Expo web loads CanvasKit WASM first (`public/canvaskit.wasm`).
 */
export function GlowingCardWrapper({
  children,
  isWishlistFulfilled = false,
  isAuraMaxed = false,
}: GlowingCardWrapperProps) {
  const [box, setBox] = useState({ width: 0, height: 0 });
  const glow = isWishlistFulfilled || isAuraMaxed;
  const ready = glow && box.width > 0 && box.height > 0;

  return (
    <View style={[styles.container, glow ? styles.glowPad : null]}>
      {ready ? (
        <View
          style={[
            styles.glow,
            {
              width: box.width + GLOW_PAD,
              height: box.height + GLOW_PAD,
              pointerEvents: 'none',
            },
          ]}
        >
          <GlowBorder
            width={box.width + GLOW_PAD}
            height={box.height + GLOW_PAD}
            borderRadius={radii.lg + 4}
            isAuraMaxed={isAuraMaxed || isWishlistFulfilled}
            wishlistFulfilled={isWishlistFulfilled}
          />
        </View>
      ) : null}
      <View
        style={styles.card}
        onLayout={(event) => {
          const { width, height } = event.nativeEvent.layout;
          setBox((current) =>
            current.width === Math.round(width) && current.height === Math.round(height)
              ? current
              : { width: Math.round(width), height: Math.round(height) },
          );
        }}
      >
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    overflow: 'visible',
  },
  glowPad: {
    padding: GLOW_INSET,
  },
  glow: {
    position: 'absolute',
    top: 0,
    alignSelf: 'center',
  },
  card: {
    width: '100%',
    zIndex: 1,
  },
});

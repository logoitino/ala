import { useState } from 'react';
import { View } from 'react-native';
import { WithSkiaWeb } from '@shopify/react-native-skia/lib/module/web';

import { radii } from '@/constants/theme';

import {
  GLOW_PAD,
  glowingCardStyles as styles,
  type GlowingCardWrapperProps,
} from '@/components/Profile/glowingCardChrome';

/**
 * @purpose Web-only loader for the Skia neon sweep. CanvasKit WASM must initialize before `@shopify/react-native-skia` is imported.
 * @param children The flippable `AuraTradingCard` (or a Studio persona card).
 * @param isWishlistFulfilled At least one wishlist item is fully funded / equipped.
 * @param isAuraMaxed Aura tier 7 — Celestial Prism.
 * @returns Same layout as native; `LoadSkiaWeb` runs via `WithSkiaWeb` then mounts `GlowingNeonBorder`.
 * @sideEffects Fetches `/canvaskit.wasm` (copied by `pnpm --filter @tapuai/mobile skia:web` / mobile `postinstall`). Never imported by the iOS/Android bundle.
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
          <WithSkiaWeb
            getComponent={() => import('@/components/Effects/GlowingNeonBorder')}
            componentProps={{
              width: box.width + GLOW_PAD,
              height: box.height + GLOW_PAD,
              borderRadius: radii.lg + 4,
              isAuraMaxed: isAuraMaxed || isWishlistFulfilled,
              wishlistFulfilled: isWishlistFulfilled,
            }}
            opts={{ locateFile: (file: string) => `/${file}` }}
            fallback={null}
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

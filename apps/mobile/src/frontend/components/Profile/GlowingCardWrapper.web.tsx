import { useEffect, useState, type ComponentType } from 'react';
import { View } from 'react-native';

import { radii } from '@/constants/theme';

import {
  GLOW_PAD,
  glowingCardStyles as styles,
  type GlowingCardWrapperProps,
} from '@/components/Profile/glowingCardChrome';

type WithSkiaWebComponent = ComponentType<{
  getComponent: () => Promise<unknown>;
  componentProps: Record<string, unknown>;
  opts: { locateFile: (file: string) => string };
  fallback: null;
}>;

/**
 * @purpose Web-only loader for the Skia neon sweep. CanvasKit WASM must initialize before `@shopify/react-native-skia` is imported.
 * @param children The flippable `AuraTradingCard` (or a Studio persona card).
 * @param isWishlistFulfilled At least one wishlist item is fully funded / equipped.
 * @param isAuraMaxed Aura tier 7 — Celestial Prism.
 * @returns Same layout as native; `LoadSkiaWeb` runs via `WithSkiaWeb` then mounts `GlowingNeonBorder`.
 * @sideEffects Client-only import of Skia web (SSR on Expo web crashed when this class loaded in Node). Fetches `/canvaskit.wasm`.
 */
export function GlowingCardWrapper({
  children,
  isWishlistFulfilled = false,
  isAuraMaxed = false,
}: GlowingCardWrapperProps) {
  const [box, setBox] = useState({ width: 0, height: 0 });
  const [WithSkiaWeb, setWithSkiaWeb] = useState<WithSkiaWebComponent | null>(null);
  const glow = isWishlistFulfilled || isAuraMaxed;
  const ready = glow && box.width > 0 && box.height > 0 && WithSkiaWeb;

  useEffect(() => {
    let cancelled = false;
    void import('@shopify/react-native-skia/lib/module/web').then((mod) => {
      if (!cancelled) setWithSkiaWeb(() => mod.WithSkiaWeb as WithSkiaWebComponent);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <View style={[styles.container, glow ? styles.glowPad : null]}>
      {ready && WithSkiaWeb ? (
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

import { type ReactNode } from 'react';
import { StyleSheet } from 'react-native';

import { GLOW_INSET } from '@/components/Effects/glowTokens';

export const GLOW_PAD = GLOW_INSET * 2;

export type GlowingCardWrapperProps = {
  children: ReactNode;
  isWishlistFulfilled?: boolean;
  isAuraMaxed?: boolean;
};

export const glowingCardStyles = StyleSheet.create({
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

import { Platform, type ViewStyle } from 'react-native';

import { FOCAL } from '@/theme/motion';

export const palette = {
  midnightObsidian: FOCAL.backgroundBase,
  neonJade: FOCAL.neonJade,
  electricGold: FOCAL.electricGold,
  slateCharcoal: '#1E262B',
};

export const colors = {
  background: palette.midnightObsidian,
  surface: palette.slateCharcoal,
  border: '#2E3A40',
  text: '#F3FBF7',
  textMuted: '#9EB0AA',
  primary: palette.neonJade,
  primaryMuted: '#00B85C',
  deepGreen: palette.neonJade,
  accent: palette.neonJade,
  accentSoft: '#16342C',
  /** Headings / Seki chrome stay jade. Rank + Gold/Platinum boosters use `electricGold`. */
  gold: palette.neonJade,
  electricGold: palette.electricGold,
  night: palette.midnightObsidian,
  onAccent: palette.midnightObsidian,
  photoPlaceholder: '#2A3439',
  success: palette.neonJade,
  danger: '#FF6B6B',
};

export const radii = {
  md: 12,
  lg: 16,
};

export const SCREEN_BOTTOM_GAP = 52;

export const cardShadow: ViewStyle = Platform.select({
  ios: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.35,
    shadowRadius: 18,
  },
  android: {
    elevation: 8,
  },
  default: {
    boxShadow: '0px 10px 18px rgba(0, 0, 0, 0.35)',
  },
}) as ViewStyle;

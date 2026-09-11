import { Platform, type ViewStyle } from 'react-native';

export const colors = {
  background: '#F4F1EC',
  surface: '#FFFFFF',
  border: '#E6E0D8',
  text: '#111827',
  textMuted: '#6B7280',
  primary: '#0B3D2E',
  primaryMuted: '#145C45',
  deepGreen: '#054A29',
  accent: '#C45C26',
  accentSoft: '#F3E6DE',
  photoPlaceholder: '#D9D3CA',
  success: '#166534',
};

export const radii = {
  md: 12,
  lg: 16,
};

export const SCREEN_BOTTOM_GAP = 52;

export const cardShadow: ViewStyle = Platform.select({
  ios: {
    shadowColor: '#111827',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
  },
  android: {
    elevation: 4,
  },
  default: {
    shadowColor: '#111827',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
  },
}) as ViewStyle;

/** Decorative sport marks accompany visible labels across fan cards and controls.
 * Unknown catalog sports use a neutral medal; the icon never identifies or verifies an athlete.
 */
import Ionicons from '@expo/vector-icons/Ionicons';
import { View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { FOCAL } from '@/theme/motion';

type SportIconProps = { sport?: string | null; color?: string; size?: number };

/** @purpose Draw an installed vector sport mark without adding a duplicate screen-reader label. */
export function SportIcon({ sport, color = FOCAL.jadeInk, size = 18 }: SportIconProps) {
  const name = sport?.trim().toLowerCase() ?? '';
  let icon: keyof typeof Ionicons.glyphMap = 'medal-outline';
  if (/football|rugby/.test(name)) icon = 'american-football-outline';
  else if (/basketball/.test(name)) icon = 'basketball-outline';
  else if (/soccer|futsal/.test(name)) icon = 'football-outline';
  else if (/baseball|softball/.test(name)) icon = 'baseball-outline';
  else if (/tennis/.test(name)) icon = 'tennisball-outline';
  else if (/golf/.test(name)) icon = 'golf-outline';
  else if (/track|cross country|running/.test(name)) icon = 'walk-outline';
  else if (/wrestling|weight|fitness/.test(name)) icon = 'barbell-outline';
  else if (/swim|water/.test(name)) icon = 'water-outline';
  return <View accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
    {/volleyball/.test(name) ? <Svg width={size} height={size} viewBox="0 0 24 24" accessible={false}>
      <Circle cx={12} cy={12} r={9} fill="none" stroke={color} strokeWidth={1.8} />
      <Path d="M7 4c4 1 7 4 8 8M3 11c4-2 8-2 12 1M8 20c0-4 3-7 7-8M15 4c-2 4-2 7 0 8M21 14c-3-3-5-4-6-2M15 21c2-3 2-6 0-9" fill="none" stroke={color} strokeWidth={1.4} />
    </Svg> : <Ionicons name={icon} color={color} size={size} />}
  </View>;
}

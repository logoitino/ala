/**
 * Faint line drawing of a sport's playing surface, laid behind athlete and game cards (UX-08).
 * Decorative only: hidden from screen readers, ignores touches, one colour at low opacity so the Calm Island
 * palette (one jade brand colour, gold for awards) is unchanged. The surface comes from `sportFieldKind`, so a
 * sport added on /admin/sports still draws something sensible (a generic field when unrecognised).
 */

import { memo, type ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Circle, Line, Path, Rect, Text as SvgText } from 'react-native-svg';

import { sportFieldKind, type SportFieldKind } from '@/data/sportField';
import { FOCAL } from '@/theme/motion';

type SportFieldProps = {
  /** Any sport label; unknown or missing draws a generic field. */
  sport?: string | null;
  /** Line colour. Defaults to brand jade ink; pass `onVideo`-style light ink on dark cards. */
  color?: string;
  /** Overall strength. Keep low (0.08–0.18) so text above stays AA. */
  opacity?: number;
  style?: StyleProp<ViewStyle>;
};

// Drawn on a 400×200 board; `slice` crops to fill any card shape without distorting circles.
const W = 400;
const H = 200;

function range(from: number, to: number, step: number): number[] {
  const out: number[] = [];
  for (let value = from; value <= to; value += step) out.push(value);
  return out;
}

function Gridiron({ c }: { c: string }) {
  const yards = range(50, 350, 30);
  const numbers = ['10', '20', '30', '40', '50', '40', '30', '20', '10'];
  return (
    <>
      <Rect x={20} y={14} width={360} height={172} stroke={c} strokeWidth={2} fill="none" />
      <Line x1={50} y1={14} x2={50} y2={186} stroke={c} strokeWidth={2} />
      <Line x1={350} y1={14} x2={350} y2={186} stroke={c} strokeWidth={2} />
      {yards.slice(1, -1).map((x) => (
        <Line key={x} x1={x} y1={14} x2={x} y2={186} stroke={c} strokeWidth={1.2} />
      ))}
      {range(56, 344, 6).filter((x) => (x - 50) % 30 !== 0).map((x) => (
        <Line key={`h${x}`} x1={x} y1={84} x2={x} y2={90} stroke={c} strokeWidth={1} />
      ))}
      {range(56, 344, 6).filter((x) => (x - 50) % 30 !== 0).map((x) => (
        <Line key={`k${x}`} x1={x} y1={110} x2={x} y2={116} stroke={c} strokeWidth={1} />
      ))}
      {numbers.map((label, i) => (
        <SvgText key={`n${i}`} x={80 + i * 30} y={172} fill={c} fontSize={9} fontWeight="700" textAnchor="middle">{label}</SvgText>
      ))}
    </>
  );
}

function Rugby({ c }: { c: string }) {
  return (
    <>
      <Rect x={14} y={14} width={372} height={172} stroke={c} strokeWidth={2} fill="none" />
      <Line x1={44} y1={14} x2={44} y2={186} stroke={c} strokeWidth={2} />
      <Line x1={356} y1={14} x2={356} y2={186} stroke={c} strokeWidth={2} />
      <Line x1={200} y1={14} x2={200} y2={186} stroke={c} strokeWidth={1.6} />
      <Line x1={112} y1={14} x2={112} y2={186} stroke={c} strokeWidth={1.4} />
      <Line x1={288} y1={14} x2={288} y2={186} stroke={c} strokeWidth={1.4} />
      <Line x1={170} y1={14} x2={170} y2={186} stroke={c} strokeWidth={1} strokeDasharray="8 7" />
      <Line x1={230} y1={14} x2={230} y2={186} stroke={c} strokeWidth={1} strokeDasharray="8 7" />
    </>
  );
}

function Pitch({ c }: { c: string }) {
  return (
    <>
      <Rect x={16} y={14} width={368} height={172} stroke={c} strokeWidth={2} fill="none" />
      <Line x1={200} y1={14} x2={200} y2={186} stroke={c} strokeWidth={1.6} />
      <Circle cx={200} cy={100} r={30} stroke={c} strokeWidth={1.6} fill="none" />
      <Circle cx={200} cy={100} r={2.5} fill={c} />
      <Rect x={16} y={52} width={56} height={96} stroke={c} strokeWidth={1.4} fill="none" />
      <Rect x={328} y={52} width={56} height={96} stroke={c} strokeWidth={1.4} fill="none" />
      <Rect x={16} y={80} width={20} height={40} stroke={c} strokeWidth={1.2} fill="none" />
      <Rect x={364} y={80} width={20} height={40} stroke={c} strokeWidth={1.2} fill="none" />
      <Path d="M72 84 A22 22 0 0 1 72 116" stroke={c} strokeWidth={1.2} fill="none" />
      <Path d="M328 84 A22 22 0 0 0 328 116" stroke={c} strokeWidth={1.2} fill="none" />
    </>
  );
}

function Court({ c }: { c: string }) {
  return (
    <>
      <Rect x={16} y={14} width={368} height={172} stroke={c} strokeWidth={2} fill="none" />
      <Line x1={200} y1={14} x2={200} y2={186} stroke={c} strokeWidth={1.6} />
      <Circle cx={200} cy={100} r={24} stroke={c} strokeWidth={1.6} fill="none" />
      <Rect x={16} y={72} width={78} height={56} stroke={c} strokeWidth={1.4} fill="none" />
      <Rect x={306} y={72} width={78} height={56} stroke={c} strokeWidth={1.4} fill="none" />
      <Circle cx={94} cy={100} r={22} stroke={c} strokeWidth={1.2} fill="none" />
      <Circle cx={306} cy={100} r={22} stroke={c} strokeWidth={1.2} fill="none" />
      <Path d="M16 26 L54 26 A80 80 0 0 1 54 174 L16 174" stroke={c} strokeWidth={1.4} fill="none" />
      <Path d="M384 26 L346 26 A80 80 0 0 0 346 174 L384 174" stroke={c} strokeWidth={1.4} fill="none" />
    </>
  );
}

function Volleyball({ c }: { c: string }) {
  return (
    <>
      <Rect x={50} y={24} width={300} height={152} stroke={c} strokeWidth={2} fill="none" />
      <Line x1={200} y1={10} x2={200} y2={190} stroke={c} strokeWidth={3} />
      <Line x1={150} y1={24} x2={150} y2={176} stroke={c} strokeWidth={1.4} />
      <Line x1={250} y1={24} x2={250} y2={176} stroke={c} strokeWidth={1.4} />
    </>
  );
}

function Tennis({ c }: { c: string }) {
  return (
    <>
      <Rect x={30} y={22} width={340} height={156} stroke={c} strokeWidth={2} fill="none" />
      <Line x1={30} y1={42} x2={370} y2={42} stroke={c} strokeWidth={1.4} />
      <Line x1={30} y1={158} x2={370} y2={158} stroke={c} strokeWidth={1.4} />
      <Line x1={200} y1={12} x2={200} y2={188} stroke={c} strokeWidth={2.6} />
      <Line x1={110} y1={42} x2={110} y2={158} stroke={c} strokeWidth={1.4} />
      <Line x1={290} y1={42} x2={290} y2={158} stroke={c} strokeWidth={1.4} />
      <Line x1={110} y1={100} x2={290} y2={100} stroke={c} strokeWidth={1.4} />
    </>
  );
}

function Diamond({ c }: { c: string }) {
  return (
    <>
      <Line x1={200} y1={190} x2={30} y2={34} stroke={c} strokeWidth={1.6} />
      <Line x1={200} y1={190} x2={370} y2={34} stroke={c} strokeWidth={1.6} />
      <Path d="M44 46 Q200 -46 356 46" stroke={c} strokeWidth={1.6} fill="none" />
      <Path d="M200 186 L262 124 L200 62 L138 124 Z" stroke={c} strokeWidth={1.6} fill="none" />
      <Path d="M118 104 Q200 34 282 104" stroke={c} strokeWidth={1.2} fill="none" />
      <Circle cx={200} cy={128} r={8} stroke={c} strokeWidth={1.4} fill="none" />
      {[[262, 124], [200, 62], [138, 124]].map(([x, y]) => (
        <Rect key={`${x}-${y}`} x={x - 4} y={y - 4} width={8} height={8} fill={c} transform={`rotate(45 ${x} ${y})`} />
      ))}
    </>
  );
}

function Track({ c }: { c: string }) {
  return (
    <>
      {[0, 1, 2, 3].map((lane) => {
        const inset = 14 + lane * 14;
        return (
          <Rect key={lane} x={inset} y={inset} width={W - inset * 2} height={H - inset * 2}
            rx={(H - inset * 2) / 2} stroke={c} strokeWidth={lane === 0 ? 2 : 1.3} fill="none" />
        );
      })}
      <Line x1={200} y1={14} x2={200} y2={70} stroke={c} strokeWidth={2.4} />
    </>
  );
}

function Mat({ c }: { c: string }) {
  return (
    <>
      <Circle cx={200} cy={100} r={88} stroke={c} strokeWidth={2} fill="none" />
      <Circle cx={200} cy={100} r={70} stroke={c} strokeWidth={1.2} fill="none" strokeDasharray="10 6" />
      <Circle cx={200} cy={100} r={12} stroke={c} strokeWidth={1.6} fill="none" />
      <Line x1={190} y1={86} x2={190} y2={114} stroke={c} strokeWidth={2} />
      <Line x1={210} y1={86} x2={210} y2={114} stroke={c} strokeWidth={2} />
    </>
  );
}

function Rink({ c }: { c: string }) {
  return (
    <>
      <Rect x={16} y={14} width={368} height={172} rx={44} stroke={c} strokeWidth={2} fill="none" />
      <Line x1={200} y1={14} x2={200} y2={186} stroke={c} strokeWidth={2.4} />
      <Line x1={150} y1={14} x2={150} y2={186} stroke={c} strokeWidth={1.8} />
      <Line x1={250} y1={14} x2={250} y2={186} stroke={c} strokeWidth={1.8} />
      <Line x1={44} y1={22} x2={44} y2={178} stroke={c} strokeWidth={1.2} />
      <Line x1={356} y1={22} x2={356} y2={178} stroke={c} strokeWidth={1.2} />
      <Circle cx={200} cy={100} r={22} stroke={c} strokeWidth={1.4} fill="none" />
      {[[90, 60], [90, 140], [310, 60], [310, 140]].map(([x, y]) => (
        <Circle key={`${x}-${y}`} cx={x} cy={y} r={20} stroke={c} strokeWidth={1.2} fill="none" />
      ))}
    </>
  );
}

// Generic playing field for sports without their own markings: reads as "a game" without claiming a sport.
function Field({ c }: { c: string }) {
  return (
    <>
      <Rect x={16} y={14} width={368} height={172} rx={10} stroke={c} strokeWidth={2} fill="none" />
      <Line x1={200} y1={14} x2={200} y2={186} stroke={c} strokeWidth={1.6} />
      <Circle cx={200} cy={100} r={28} stroke={c} strokeWidth={1.6} fill="none" />
      <Circle cx={200} cy={100} r={2.5} fill={c} />
    </>
  );
}

const SURFACES: Record<SportFieldKind, (props: { c: string }) => ReactNode> = {
  gridiron: Gridiron,
  rugby: Rugby,
  pitch: Pitch,
  court: Court,
  volleyball: Volleyball,
  tennis: Tennis,
  diamond: Diamond,
  track: Track,
  mat: Mat,
  rink: Rink,
  field: Field,
};

/**
 * @purpose Fill the parent (absolute) with the sport's surface markings; the parent should clip (`overflow: 'hidden'`).
 * @param sport Sport label; drives the surface through `sportFieldKind`.
 * @returns A non-interactive, screen-reader-hidden SVG layer.
 */
function SportFieldImpl({ sport, color = FOCAL.jadeInk, opacity = 0.12, style }: SportFieldProps) {
  const kind = sportFieldKind(sport);
  const Surface = SURFACES[kind];
  return (
    <View
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      testID={`sport-field-${kind}`}
      style={[StyleSheet.absoluteFill, { opacity }, style]}
    >
      <Svg width="100%" height="100%" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid slice">
        <Surface c={color} />
      </Svg>
    </View>
  );
}

export const SportField = memo(SportFieldImpl);

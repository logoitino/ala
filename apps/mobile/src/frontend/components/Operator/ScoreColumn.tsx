/**
 * One side of the operator scoreboard: team, animated score and the sport's score-step buttons
 * (split out of app/operator/[gameId].tsx for R4-03; behaviour unchanged). Steps come from the game's
 * sport playbook (`/admin/sports`); the screen owns the `update_game_score` call behind `onBump`.
 * @sideEffects Light haptic on each step tap (via AnimatedPressable).
 */
import { useEffect, useRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withSpring, withTiming } from 'react-native-reanimated';

import { AnimatedPressable } from '@/components/UI/AnimatedPressable';
import { colors, radii } from '@/constants/theme';
import { displayValue } from '@/data/players';
import type { SportScoreAction } from '@/data/sports';
import { SPRING_BOUNCE } from '@/theme/motion';

/** @purpose One side of the scoreboard. `steps` are the sport's score buttons from `/admin/sports`. */
export function ScoreColumn({
  label,
  team,
  value,
  disabled,
  steps,
  onBump,
}: {
  label: string;
  team: string;
  value: number;
  disabled: boolean;
  steps: SportScoreAction[];
  onBump: (points: number) => void;
}) {
  const scale = useSharedValue(1);
  const prev = useRef(value);
  useEffect(() => {
    if (prev.current === value) return;
    prev.current = value;
    scale.value = withSequence(withSpring(1.2, SPRING_BOUNCE), withSpring(1, SPRING_BOUNCE));
  }, [scale, value]);
  const scoreStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <View style={styles.scoreCol}>
      <Text style={styles.scoreTeamLabel}>{label}</Text>
      <Text style={styles.scoreTeam} numberOfLines={1}>
        {displayValue(team)}
      </Text>
      <Animated.Text style={[styles.score, scoreStyle]}>{value}</Animated.Text>
      <View style={styles.stepCol}>
        {steps.map((step) => (
          <ScoreStepButton
            key={step.id}
            label={label}
            points={step.points}
            hint={step.label}
            disabled={disabled}
            onPress={() => onBump(step.points)}
          />
        ))}
      </View>
    </View>
  );
}

/**
 * @purpose One score-step button (+1 / +3 / +6…). Flashes white the instant it's tapped, before the
 * `update_game_score` RPC resolves, so the operator gets confirmation the tap registered even under time pressure.
 */
function ScoreStepButton({
  label,
  points,
  hint,
  disabled,
  onPress,
}: {
  label: string;
  points: number;
  hint: string;
  disabled: boolean;
  onPress: () => void;
}) {
  const flash = useSharedValue(0);
  const flashStyle = useAnimatedStyle(() => ({ opacity: flash.value }));

  return (
    <AnimatedPressable
      haptic="light"
      scaleTo={0.92}
      disabled={disabled}
      accessibilityLabel={`${label} ${hint}`}
      onPress={() => {
        flash.value = withSequence(withTiming(0.55, { duration: 40 }), withTiming(0, { duration: 220 }));
        onPress();
      }}
      contentStyle={[styles.step, disabled && styles.disabled]}
    >
      <Animated.View pointerEvents="none" style={[styles.stepFlash, flashStyle]} />
      <Text style={styles.stepLabel}>+{points}</Text>
      <Text style={styles.stepHint}>{hint}</Text>
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  scoreCol: {
    flex: 1,
    gap: 6,
    alignItems: 'center',
  },
  scoreTeamLabel: {
    color: colors.primary,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
  },
  scoreTeam: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '800',
    textAlign: 'center',
  },
  score: {
    color: colors.primary,
    fontSize: 40,
    fontWeight: '800',
    letterSpacing: -1,
  },
  stepCol: {
    alignSelf: 'stretch',
    gap: 6,
  },
  step: {
    minHeight: 44,
    borderRadius: radii.md,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    overflow: 'hidden',
  },
  stepFlash: {
    ...StyleSheet.absoluteFill,
    backgroundColor: colors.onAccent,
  },
  stepLabel: {
    color: colors.onAccent,
    fontSize: 16,
    fontWeight: '800',
  },
  stepHint: {
    color: colors.onAccent,
    fontSize: 9,
    fontWeight: '700',
    opacity: 0.8,
  },
  disabled: {
    opacity: 0.55,
  },
});

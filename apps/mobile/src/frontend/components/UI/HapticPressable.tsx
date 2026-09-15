import { Pressable, type PressableProps } from 'react-native';

import { impactPress, type PressHaptic } from '@/lib/haptics';

type HapticPressableProps = PressableProps & {
  haptic?: PressHaptic;
};

/**
 * @purpose Drop-in `Pressable` that fires `Haptics.impactAsync(Light)` on a successful press.
 * @param haptic `light` (default). `medium`/`selection` also fire Light. `none` for swallow/backdrop containers.
 * @returns The RN pressable with haptic + disabled short-circuit.
 * @sideEffects Native haptics on press when not disabled.
 */
export function HapticPressable({
  haptic = 'light',
  disabled,
  onPress,
  ...rest
}: HapticPressableProps) {
  return (
    <Pressable
      {...rest}
      disabled={disabled}
      onPress={(event) => {
        if (disabled) return;
        impactPress(haptic);
        onPress?.(event);
      }}
    />
  );
}

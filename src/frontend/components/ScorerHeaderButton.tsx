import Ionicons from '@expo/vector-icons/Ionicons';
import { type Href, useRouter } from 'expo-router';
import { StyleSheet } from 'react-native';
import { HapticPressable as Pressable } from '@/components/UI/HapticPressable';

import { colors } from '@/constants/theme';

export function ScorerHeaderButton() {
  const router = useRouter();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Open Sideline Scorer Portal"
      hitSlop={10}
      onPress={() => router.push('/operator/scorer' as Href)}
      style={({ pressed }) => [styles.button, pressed && styles.pressed]}
    >
      <Ionicons name="shield-checkmark-outline" size={22} color={colors.primary} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
    marginRight: 4,
  },
  pressed: {
    opacity: 0.7,
  },
});

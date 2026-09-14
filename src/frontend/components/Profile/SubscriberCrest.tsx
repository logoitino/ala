import { StyleSheet, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';

const NEON_JADE = '#00E676';

type SubscriberCrestProps = {
  size?: number;
};

/**
 * @purpose Neon Jade star that marks an exclusive subscriber on avatars and Q&A rows.
 * @param size Icon size in points (badge scales around it).
 * @returns Small jade star chip for overlaying the top-right of an avatar.
 */
export function SubscriberCrest({ size = 11 }: SubscriberCrestProps) {
  const box = size + 8;

  return (
    <View
      accessibilityRole="image"
      accessibilityLabel="Subscriber"
      style={[
        styles.badge,
        {
          width: box,
          height: box,
          borderRadius: box / 2,
        },
      ]}
    >
      <Ionicons name="star" size={size} color={NEON_JADE} />
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    backgroundColor: '#0F1416',
    borderWidth: 1,
    borderColor: NEON_JADE,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

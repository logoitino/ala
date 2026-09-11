import { useEffect, useRef, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, radii } from '@/constants/theme';
import { QUICK_REACTIONS, type QuickReaction } from '@/data/players';

type ReactionButtonsProps = {
  playerName: string;
};

export function ReactionButtons({ playerName }: ReactionButtonsProps) {
  const [sekiHint, setSekiHint] = useState(false);
  const hintTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (hintTimer.current) clearTimeout(hintTimer.current);
    };
  }, []);

  const revealSekiHint = (persist = false) => {
    setSekiHint(true);
    if (hintTimer.current) clearTimeout(hintTimer.current);
    if (persist) return;
    hintTimer.current = setTimeout(() => setSekiHint(false), 1800);
  };

  const handleReaction = (reaction: QuickReaction) => {
    if (reaction.id === 'seki') revealSekiHint();
    Alert.alert(`Sent ${reaction.reaction} to ${playerName}!`);
  };

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Quick Reactions</Text>
      <View style={styles.row}>
        {QUICK_REACTIONS.map((reaction) => (
          <Pressable
            key={reaction.id}
            accessibilityRole="button"
            accessibilityHint={reaction.id === 'seki' ? 'Awesome' : undefined}
            onPress={() => handleReaction(reaction)}
            onHoverIn={() => {
              if (reaction.id === 'seki') revealSekiHint(true);
            }}
            onHoverOut={() => {
              if (reaction.id === 'seki') setSekiHint(false);
            }}
            style={({ pressed }) => [
              styles.button,
              reaction.id === 'seki' && styles.sekiButton,
              pressed && styles.buttonPressed,
            ]}
          >
            <Text style={styles.label}>{reaction.label}</Text>
            {reaction.id === 'seki' && sekiHint ? (
              <Text style={styles.hint}>Awesome</Text>
            ) : null}
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
  },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  button: {
    flexGrow: 1,
    flexBasis: '30%',
    minWidth: 96,
    paddingVertical: 14,
    paddingHorizontal: 10,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
  },
  sekiButton: {
    borderColor: '#F4C430',
    backgroundColor: '#FFF8E1',
  },
  buttonPressed: {
    backgroundColor: colors.accentSoft,
    borderColor: '#E8CFC0',
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  hint: {
    marginTop: 4,
    fontSize: 11,
    fontWeight: '800',
    color: colors.deepGreen,
  },
});

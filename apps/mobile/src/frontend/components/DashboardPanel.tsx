import { type ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { cardShadow, colors, radii } from '@/constants/theme';
import { FOCAL } from '@/theme/motion';

type DashboardPanelProps = {
  title: string;
  body?: string;
  children?: ReactNode;
};

export function DashboardPanel({ title, body, children }: DashboardPanelProps) {
  return (
    <View style={styles.panel}>
      <Text style={styles.title}>{title}</Text>
      {body ? <Text style={styles.body}>{body}</Text> : null}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    borderLeftWidth: 3,
    borderLeftColor: FOCAL.electricGold,
    padding: 16,
    gap: 10,
    ...cardShadow,
  },
  title: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.text,
  },
  body: {
    fontSize: 14,
    lineHeight: 20,
    color: colors.textMuted,
  },
});

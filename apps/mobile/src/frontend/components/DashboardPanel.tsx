/**
 * Titled card used by the role dashboards (Athlete / Parent / Booster / Sponsor HQ): a plain surface card with a
 * section title, optional body text and children (2026-11 refresh dropped the gold left edge so gold stays for awards).
 */

import { type ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { cardShadow, colors, radii } from '@/constants/theme';
import { FONT } from '@/theme/fonts';

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
    padding: 18,
    gap: 12,
    ...cardShadow,
  },
  title: {
    fontFamily: FONT.displayBold,
    fontWeight: 'normal',
    fontSize: 18,
    color: colors.text,
    letterSpacing: -0.3,
  },
  body: {
    fontSize: 14,
    lineHeight: 20,
    color: colors.textMuted,
  },
});

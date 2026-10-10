/**
 * Open flags table on the Expo /admin moderation desk.
 * Target stays the clip. Reason and Athlete or guardian sit on the same row.
 */
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { AnimatedButton } from '@/components/UI/AnimatedButton';
import { colors, radii } from '@/constants/theme';
import type { AdminFlagRow } from '@/lib/admin';
import { FOCAL } from '@/theme/motion';

type ModerationTableProps = {
  flags: AdminFlagRow[];
  busyId: string | null;
  onDismiss: (row: AdminFlagRow) => void;
  onRemove: (row: AdminFlagRow) => void;
};

function athleteOrGuardianLabel(value: AdminFlagRow['athleteOrGuardian']): string {
  if (value === 'yes') return 'Yes';
  if (value === 'no') return 'No';
  if (value === 'unchecked') return 'Not checked';
  return '—';
}

function formatOpened(iso: string): string {
  if (!iso) return '—';
  const stamp = Date.parse(iso);
  if (!Number.isFinite(stamp)) return iso.slice(0, 10);
  return new Date(stamp).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

/**
 * @purpose Admin table of open Highlight flags, with the report reason and whether an athlete or guardian reported the clip.
 * @sideEffects Parent fires `moderate_flagged_reel` or deletes a telemetry row.
 */
export function ModerationTable({ flags, busyId, onDismiss, onRemove }: ModerationTableProps) {
  return (
    <View style={styles.panel}>
      <Text style={styles.title}>Open flags</Text>
      <Text style={styles.lede}>
        User flags from Highlights ⚡ plus stall and reconnect bug reports. Reason is the stored report. Athlete or guardian is Yes when that athlete or their guardian reported the clip. Dismiss keeps the clip live. Remove Content takes it off the feed.
      </Text>

      <View style={styles.head} accessibilityRole="header">
        <Text style={[styles.headCell, styles.colKind]}>Kind</Text>
        <Text style={[styles.headCell, styles.colTarget]}>Target</Text>
        <Text style={[styles.headCell, styles.colReason]}>Reason</Text>
        <Text style={[styles.headCell, styles.colCount]}>Reports</Text>
        <Text style={[styles.headCell, styles.colWho]}>Athlete or guardian</Text>
        <Text style={[styles.headCell, styles.colWhen]}>Opened</Text>
        <Text style={[styles.headCell, styles.colActions]}>Actions</Text>
      </View>

      {flags.length === 0 ? (
        <Text style={styles.empty}>Queue is clear.</Text>
      ) : (
        flags.map((row) => {
          const busy = busyId === row.id;
          const canRemove = row.kind === 'highlight';
          return (
            <View key={row.id} style={styles.row}>
              <Text style={[styles.cell, styles.colKind]}>
                {row.kind === 'highlight' ? 'User flag' : 'Bug report'}
              </Text>
              <View style={styles.colTarget}>
                <Text style={styles.targetTitle} numberOfLines={1}>
                  {row.title}
                </Text>
                <Text style={styles.targetMeta} numberOfLines={1}>
                  {row.subtitle}
                </Text>
              </View>
              <Text style={[styles.cell, styles.colReason]} numberOfLines={2} accessibilityLabel={`Reason: ${row.reasonLabel}`}>
                {row.reasonLabel}
              </Text>
              <Text style={[styles.cell, styles.colCount]}>{row.reportCount}</Text>
              <Text
                style={[styles.cell, styles.colWho]}
                numberOfLines={2}
                accessibilityLabel={`Athlete or guardian: ${athleteOrGuardianLabel(row.athleteOrGuardian)}`}
              >
                {athleteOrGuardianLabel(row.athleteOrGuardian)}
              </Text>
              <Text style={[styles.cell, styles.colWhen]}>{formatOpened(row.openedAt)}</Text>
              <View style={styles.colActions}>
                {busy ? (
                  <ActivityIndicator color={FOCAL.jadeInk} />
                ) : (
                  <>
                    <AnimatedButton
                      haptic="selection"
                      accessibilityLabel={`Dismiss ${row.title}`}
                      contentStyle={styles.ghost}
                      onPress={() => onDismiss(row)}
                    >
                      <Text style={styles.ghostLabel}>Dismiss</Text>
                    </AnimatedButton>
                    {canRemove ? (
                      <AnimatedButton
                        haptic="medium"
                        accessibilityLabel={`Remove content ${row.title}`}
                        contentStyle={styles.danger}
                        onPress={() => onRemove(row)}
                      >
                        <Text style={styles.dangerLabel}>Remove Content</Text>
                      </AnimatedButton>
                    ) : null}
                  </>
                )}
              </View>
            </View>
          );
        })
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    gap: 10,
  },
  title: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '800',
  },
  lede: {
    color: colors.textMuted,
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 20,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headCell: {
    color: FOCAL.jadeInk,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  cell: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '700',
  },
  colKind: {
    width: 92,
  },
  colTarget: {
    flex: 1,
    minWidth: 120,
  },
  colReason: {
    flex: 1,
    minWidth: 140,
  },
  colCount: {
    width: 64,
  },
  colWho: {
    width: 128,
  },
  colWhen: {
    width: 96,
  },
  colActions: {
    width: 168,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    justifyContent: 'flex-end',
  },
  targetTitle: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '800',
  },
  targetMeta: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '600',
  },
  ghost: {
    minHeight: 32,
    paddingHorizontal: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ghostLabel: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '800',
  },
  danger: {
    minHeight: 32,
    paddingHorizontal: 10,
    borderRadius: 999,
    backgroundColor: colors.danger,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dangerLabel: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '800',
  },
  empty: {
    color: colors.textMuted,
    fontSize: 14,
    fontWeight: '600',
    paddingVertical: 12,
  },
});

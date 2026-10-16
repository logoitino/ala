/**
 * Open flags on the Expo /admin moderation desk, using a wide table or complete detail rows.
 * Keep all stored evidence visible; only Highlight reports offer content removal.
 */
import { ActivityIndicator, StyleSheet, Text, View, useWindowDimensions } from 'react-native';

import { ADMIN_REPORT_COLORS as colors } from '@/components/Admin/AdminChrome';
import { AnimatedButton } from '@/components/UI/AnimatedButton';
import type { AdminFlagRow } from '@/lib/admin';

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
  const { width, fontScale } = useWindowDimensions();
  // Seven columns need room for complete evidence; larger native text reads better as labeled details.
  const wide = width >= 1100 && fontScale <= 1.1;
  return (
    <View style={styles.panel}>
      <Text style={styles.title}>Open flags</Text>
      <Text style={styles.lede}>
        User flags from Highlights ⚡. Reason is the stored report. Athlete or guardian is Yes when that athlete or their guardian reported the clip. Dismiss clears a report; Remove Content takes a Highlight off the feed. Client incidents are handled in QA.
      </Text>

      {wide ? <View style={styles.head}>
        <Text style={[styles.headCell, styles.colKind]}>Kind</Text>
        <Text style={[styles.headCell, styles.colTarget]}>Target</Text>
        <Text style={[styles.headCell, styles.colReason]}>Reason</Text>
        <Text style={[styles.headCell, styles.colCount]}>Reports</Text>
        <Text style={[styles.headCell, styles.colWho]}>Athlete or guardian</Text>
        <Text style={[styles.headCell, styles.colWhen]}>Opened</Text>
        <Text style={[styles.headCell, styles.colActions]}>Actions</Text>
      </View> : null}

      {flags.length === 0 ? (
        <Text style={styles.empty}>Queue is clear.</Text>
      ) : (
        flags.map((row) => {
          const busy = busyId === row.id;
          const canRemove = row.kind === 'highlight';
          const kind = canRemove ? 'User flag' : 'Bug report';
          const who = athleteOrGuardianLabel(row.athleteOrGuardian);
          const opened = formatOpened(row.openedAt);
          const actions = (
            <View style={wide ? styles.colActions : styles.detailActions}>
              {busy ? (
                <ActivityIndicator color={colors.jade} accessibilityLabel={`Updating ${row.title}`} />
              ) : (
                <>
                  <AnimatedButton
                    haptic="selection"
                    accessibilityLabel={`Dismiss ${row.title}`}
                    style={styles.actionHit}
                    contentStyle={styles.ghost}
                    onPress={() => onDismiss(row)}
                  >
                    <Text style={styles.ghostLabel}>Dismiss</Text>
                  </AnimatedButton>
                  {canRemove ? (
                    <AnimatedButton
                      haptic="medium"
                      accessibilityLabel={`Remove content ${row.title}`}
                      style={styles.actionHit}
                      contentStyle={styles.danger}
                      onPress={() => onRemove(row)}
                    >
                      <Text style={styles.dangerLabel}>Remove Content</Text>
                    </AnimatedButton>
                  ) : null}
                </>
              )}
            </View>
          );
          if (!wide) {
            return (
              <View key={row.id} style={styles.detailRow}>
                <View style={styles.target}>
                  <Text style={styles.kind} accessibilityLabel={`Kind: ${kind}`}>{kind}</Text>
                  <Text style={styles.targetTitle}>{row.title}</Text>
                  <Text style={styles.targetMeta}>{row.subtitle}</Text>
                </View>
                <View style={styles.detailField}>
                  <Text style={styles.detailLabel}>Reason</Text>
                  <Text style={styles.cell} accessibilityLabel={`Reason: ${row.reasonLabel}`}>{row.reasonLabel}</Text>
                </View>
                <View style={styles.details}>
                  <View style={styles.detailMeta}>
                    <Text style={styles.detailLabel}>Reports</Text>
                    <Text style={styles.cell} accessibilityLabel={`Reports: ${row.reportCount}`}>{row.reportCount}</Text>
                  </View>
                  <View style={styles.detailMeta}>
                    <Text style={styles.detailLabel}>Athlete or guardian</Text>
                    <Text style={styles.cell} accessibilityLabel={`Athlete or guardian: ${who}`}>{who}</Text>
                  </View>
                  <View style={styles.detailMeta}>
                    <Text style={styles.detailLabel}>Opened</Text>
                    <Text style={styles.cell} accessibilityLabel={`Opened: ${opened}`}>{opened}</Text>
                  </View>
                </View>
                {actions}
              </View>
            );
          }
          return (
            <View key={row.id} style={styles.row}>
              <Text style={[styles.cell, styles.colKind]} accessibilityLabel={`Kind: ${kind}`}>
                {kind}
              </Text>
              <View style={styles.colTarget}>
                <Text style={styles.targetTitle}>
                  {row.title}
                </Text>
                <Text style={styles.targetMeta}>
                  {row.subtitle}
                </Text>
              </View>
              <Text style={[styles.cell, styles.colReason]} accessibilityLabel={`Reason: ${row.reasonLabel}`}>
                {row.reasonLabel}
              </Text>
              <Text style={[styles.cell, styles.colCount]} accessibilityLabel={`Reports: ${row.reportCount}`}>{row.reportCount}</Text>
              <Text
                style={[styles.cell, styles.colWho]}
                accessibilityLabel={`Athlete or guardian: ${who}`}
              >
                {who}
              </Text>
              <Text style={[styles.cell, styles.colWhen]} accessibilityLabel={`Opened: ${opened}`}>{opened}</Text>
              {actions}
            </View>
          );
        })
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    borderTopWidth: 1,
    borderColor: colors.border,
    paddingVertical: 20,
    gap: 12,
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
    color: colors.jade,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  cell: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 19,
    minWidth: 0,
  },
  colKind: {
    width: 80,
  },
  colTarget: {
    flex: 1,
    minWidth: 0,
    gap: 4,
  },
  colReason: {
    flex: 1,
    minWidth: 0,
  },
  colCount: {
    width: 64,
  },
  colWho: {
    width: 120,
  },
  colWhen: {
    width: 112,
  },
  colActions: {
    width: 152,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'flex-end',
  },
  targetTitle: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '800',
    lineHeight: 20,
  },
  targetMeta: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 19,
  },
  detailRow: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingVertical: 16,
    gap: 14,
  },
  target: {
    gap: 4,
  },
  kind: {
    color: colors.jade,
    fontSize: 12,
    fontWeight: '800',
    lineHeight: 18,
  },
  detailField: {
    gap: 4,
  },
  details: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
  },
  detailMeta: {
    flexBasis: 150,
    flexGrow: 1,
    minWidth: 0,
    gap: 4,
  },
  detailLabel: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 18,
  },
  detailActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    alignItems: 'center',
  },
  actionHit: {
    minWidth: 44,
    minHeight: 44,
  },
  ghost: {
    minHeight: 44,
    minWidth: 44,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ghostLabel: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '800',
  },
  danger: {
    minHeight: 44,
    minWidth: 44,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.danger,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dangerLabel: {
    color: colors.danger,
    fontSize: 13,
    fontWeight: '800',
  },
  empty: {
    color: colors.textMuted,
    fontSize: 14,
    fontWeight: '600',
    paddingVertical: 12,
  },
});

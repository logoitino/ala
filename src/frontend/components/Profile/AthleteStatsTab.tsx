import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { colors, radii } from '@/constants/theme';
import { displayValue } from '@/data/players';
import type { AthleteStatsBundle } from '@/data/athleteStats';
import { FOCAL } from '@/theme/motion';

type AthleteStatsTabProps = {
  stats: AthleteStatsBundle;
  loading?: boolean;
};

function formatLogDate(iso: string): string {
  const date = new Date(`${iso}T12:00:00`);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

/**
 * @purpose Stats 📊 pane: combine measurables, sport-specific career table, recent game log.
 * @param stats Bundle from `useAthleteStats`.
 * @param loading Shows a compact spinner over the table while the first fetch is in flight.
 */
export function AthleteStatsTab({ stats, loading = false }: AthleteStatsTabProps) {
  const { physicals, career, logs } = stats;
  const rows = [
    { label: 'Games Played', value: String(career.gamesPlayed) },
    { label: career.columns.scoring, value: String(career.scoringValue) },
    { label: career.columns.volume, value: String(career.volumeValue) },
    { label: 'MVP Badges', value: String(career.mvpBadges) },
  ];

  return (
    <View style={styles.wrap}>
      <Text style={styles.kicker}>Combine</Text>
      <View style={styles.metrics}>
        <Metric label="Height" value={physicals.height} />
        <Metric label="Weight" value={physicals.weight} />
        <Metric label="40-Yard Dash" value={physicals.fortyYard} />
        <Metric label="Vertical Jump" value={physicals.verticalJump} />
      </View>

      <View style={styles.tableHead}>
        <Text style={styles.kicker}>Career summary · {career.sport}</Text>
        {loading ? <ActivityIndicator color={colors.primary} size="small" /> : null}
      </View>
      <View style={styles.table}>
        <View style={styles.tableRow}>
          <Text style={[styles.cell, styles.cellHead]}>Stat</Text>
          <Text style={[styles.cell, styles.cellHead, styles.cellRight]}>Value</Text>
        </View>
        {rows.map((row) => (
          <View key={row.label} style={styles.tableRow}>
            <Text style={styles.cell}>{row.label}</Text>
            <Text style={[styles.cell, styles.cellRight, styles.cellValue]}>{row.value}</Text>
          </View>
        ))}
      </View>

      <Text style={styles.kicker}>Game log</Text>
      {logs.length === 0 ? (
        <Text style={styles.empty}>No games logged yet.</Text>
      ) : (
        logs.map((row) => (
          <View key={row.id} style={styles.log}>
            <View style={styles.logTop}>
              <Text style={styles.logDate}>{formatLogDate(row.playedOn)}</Text>
              <Text style={styles.logStat}>{row.statLine || `${row.scoringValue} ${career.columns.scoring}`}</Text>
            </View>
            <Text style={styles.logOpp}>vs {displayValue(row.opponentSchool, 'Opponent')}</Text>
          </View>
        ))
      )}
    </View>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.metric}>
      <Text style={styles.metricValue}>{value}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: 12,
  },
  kicker: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  metrics: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  metric: {
    flexGrow: 1,
    flexBasis: '46%',
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 12,
    paddingHorizontal: 12,
    gap: 4,
  },
  metricValue: {
    color: FOCAL.neonJade,
    fontSize: 18,
    fontWeight: '800',
  },
  metricLabel: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '700',
  },
  tableHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  table: {
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  tableRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  cell: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
  },
  cellHead: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  cellRight: {
    textAlign: 'right',
    flex: 0.6,
  },
  cellValue: {
    color: FOCAL.neonJade,
    fontWeight: '800',
  },
  log: {
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 4,
  },
  logTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
  },
  logDate: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '700',
  },
  logStat: {
    color: FOCAL.neonJade,
    fontSize: 13,
    fontWeight: '800',
  },
  logOpp: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '800',
  },
  empty: {
    color: colors.textMuted,
    fontSize: 13,
  },
});

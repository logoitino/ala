import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { EmptyState } from '@/components/UI/EmptyState';
import { colors, radii } from '@/constants/theme';
import { displayValue } from '@/data/players';
import type { AthleteStatsBundle } from '@/data/athleteStats';
import {
  sportConfigFor,
  visibleMeasurables,
  visibleStatFields,
  type SportConfig,
  type SportStatSource,
} from '@/data/sports';
import { FOCAL } from '@/theme/motion';

type AthleteStatsTabProps = {
  stats: AthleteStatsBundle;
  loading?: boolean;
  /** Playbook from `/admin/sports`. Decides which combine tiles and career rows render, and their labels. */
  config?: SportConfig;
};

function formatLogDate(iso: string): string {
  const date = new Date(`${iso}T12:00:00`);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

/**
 * @purpose Stats 📊 pane: combine measurables, career table, recent game log — all shaped by the sport's playbook.
 * @param stats Bundle from `useAthleteStats`.
 * @param loading Shows a compact spinner over the table while the first fetch is in flight.
 * @param config Sport playbook (`sport_configs`); falls back to the seeded catalog for this athlete's sport.
 */
export function AthleteStatsTab({ stats, loading = false, config }: AthleteStatsTabProps) {
  const { physicals, career, logs } = stats;
  const playbook = config ?? sportConfigFor(career.sport);
  const combine = visibleMeasurables(playbook);
  const careerValues: Record<SportStatSource, number> = {
    games: career.gamesPlayed,
    scoring: career.scoringValue,
    volume: career.volumeValue,
    mvp: career.mvpBadges,
  };
  const rows = visibleStatFields(playbook).map((field) => ({
    label: field.label,
    value: String(careerValues[field.source] ?? 0),
  }));

  return (
    <View style={styles.wrap}>
      {combine.length > 0 ? (
        <>
          <Text style={styles.kicker}>Combine</Text>
          <View style={styles.metrics}>
            {combine.map((metric) => (
              <Metric key={metric.key} label={metric.label} value={physicals[metric.key]} />
            ))}
          </View>
        </>
      ) : null}

      <View style={styles.tableHead}>
        <Text style={styles.kicker}>
          Career summary · {playbook.emoji} {career.sport}
        </Text>
        {loading ? <ActivityIndicator color={colors.primary} size="small" /> : null}
      </View>
      {rows.length === 0 ? (
        <EmptyState
          kicker="Career"
          title="No career stats published for this sport"
          lede="The Sports playbook decides which rows fans see. Add stats fields, then they land here."
          adminHref="/admin/sports"
          adminLabel="Open Sports"
        />
      ) : (
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
      )}

      <Text style={styles.kicker}>Game log</Text>
      {logs.length === 0 ? (
        <EmptyState
          kicker="Game log"
          title="No games logged yet"
          lede="Recent matches for this sport show here once game logs are published."
          adminHref="/admin/athletes"
          adminLabel="Open Athletes"
        />
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
    color: FOCAL.jadeInk,
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
    color: FOCAL.jadeInk,
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
    color: FOCAL.jadeInk,
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

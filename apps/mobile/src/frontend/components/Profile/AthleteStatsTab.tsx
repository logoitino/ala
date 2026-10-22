/** Profile Stats uses the athlete's exact sport playbook for published career rows and measurables. Missing values
 * stay as dashes; an unrelated caller playbook must never relabel another sport's stored numbers. */
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { EmptyState } from '@/components/UI/EmptyState';
import { SportIcon } from '@/components/UI/SportIcon';
import { colors, radii } from '@/constants/theme';
import { displayValue } from '@/data/players';
import { athleteStatsPlaybookForSport, type AthleteStatsBundle } from '@/data/athleteStats';
import {
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
 * @purpose Sports stat tiles lead the pane; recorded measurables and game logs follow the same playbook.
 * @param stats Bundle from `useAthleteStats`.
 * @param loading Shows a compact spinner over the table while the first fetch is in flight.
 * @param config Sport playbook (`sport_configs`); falls back to the seeded catalog for this athlete's sport.
 */
export function AthleteStatsTab({ stats, loading = false, config }: AthleteStatsTabProps) {
  const { physicals, career, logs } = stats;
  const playbook = athleteStatsPlaybookForSport(career.sport, config ? [config] : undefined);
  const combine = visibleMeasurables(playbook);
  const careerValues: Record<SportStatSource, number | null> = {
    games: career.gamesPlayed,
    scoring: career.scoringValue,
    volume: career.volumeValue,
    mvp: career.mvpBadges,
  };
  const rows = visibleStatFields(playbook).map((field) => ({
    label: field.label,
    value: String(careerValues[field.source] ?? '—'),
  }));

  return (
    <View style={styles.wrap}>
      <View style={styles.tableHead}>
        <SportIcon sport={career.sport} color={FOCAL.violetInk} size={16} />
        <Text style={styles.kicker}>
          {career.sport || 'Sport not set'} · Career stats
        </Text>
        {loading ? <ActivityIndicator color={colors.primary} size="small" /> : null}
      </View>
      {rows.length === 0 ? (
        <EmptyState
          compact
          accent={FOCAL.violetInk}
          kicker="Career"
          title="No career stats published for this sport"
          lede="Career stats appear here once this athlete's sport is set and stats are published."
          adminHref="/admin/sports"
          adminLabel="Open Sports"
        />
      ) : (
        <View style={styles.metrics}>
          {rows.map((row) => <View key={row.label} style={styles.statTile}
            accessible accessibilityLabel={`${row.label}: ${row.value}`}>
            <Text style={styles.statValue}>{row.value}</Text>
            <Text style={styles.statLabel}>{row.label}</Text>
          </View>)}
        </View>
      )}

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

      <Text style={styles.kicker}>Game log</Text>
      {logs.length === 0 ? (
        <EmptyState
          compact
          accent={FOCAL.violetInk}
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
    gap: 8,
  },
  kicker: {
    color: FOCAL.violetInk,
    fontSize: 12,
    flexShrink: 1,
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
    paddingVertical: 10,
    paddingHorizontal: 10,
    gap: 4,
  },
  metricValue: {
    color: FOCAL.violetInk,
    fontSize: 16,
    fontWeight: '800',
  },
  metricLabel: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '700',
  },
  statTile: { flexGrow: 1, flexBasis: '44%', minWidth: 100, padding: 10, gap: 3, borderRadius: radii.md, backgroundColor: FOCAL.mistViolet, borderTopWidth: 3, borderTopColor: FOCAL.electricViolet },
  statValue: { color: FOCAL.violetInk, fontSize: 24, fontWeight: '900' },
  statLabel: { color: FOCAL.violetInk, fontSize: 12, fontWeight: '800' },
  tableHead: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  log: {
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 10,
    paddingVertical: 10,
    gap: 4,
  },
  logTop: {
    flexDirection: 'row',
    flexWrap: 'wrap',
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
    fontSize: 14,
    fontWeight: '800',
  },
  empty: {
    color: colors.textMuted,
    fontSize: 13,
  },
});

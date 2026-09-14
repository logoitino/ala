import { useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TextInput, View } from 'react-native';

import { AnimatedButton } from '@/components/UI/AnimatedButton';
import { HapticPressable as Pressable } from '@/components/UI/HapticPressable';
import { colors, radii } from '@/constants/theme';
import { defaultSpotlightWindow, filterAdminAthletes } from '@/lib/admin';
import { spotlightWindowLabel } from '@/lib/spotlight';
import { FOCAL } from '@/theme/motion';
import type { Player, SpotlightAward, SpotlightPeriodKind } from '@/types/database';

type SpotlightManagerProps = {
  players: Player[];
  awards: SpotlightAward[];
  busy: boolean;
  onPublish: (input: {
    playerId: string;
    headline: string;
    periodKind: SpotlightPeriodKind;
    startDate: string;
    endDate: string;
  }) => Promise<unknown>;
};

/**
 * @purpose Admin form to publish Player of the Week / Month (`spotlight_awards`).
 * @sideEffects Parent calls `publish_spotlight_award`.
 */
export function SpotlightManager({ players, awards, busy, onPublish }: SpotlightManagerProps) {
  const [query, setQuery] = useState('');
  const [player, setPlayer] = useState<Player | null>(null);
  const [headline, setHeadline] = useState('');
  const [periodKind, setPeriodKind] = useState<SpotlightPeriodKind>('week');
  const window = useMemo(() => defaultSpotlightWindow(periodKind), [periodKind]);
  const [startDate, setStartDate] = useState(window.start);
  const [endDate, setEndDate] = useState(window.end);
  const [message, setMessage] = useState<string | null>(null);
  const matches = useMemo(() => filterAdminAthletes(players, query), [players, query]);

  const applyPeriod = (kind: SpotlightPeriodKind) => {
    setPeriodKind(kind);
    const next = defaultSpotlightWindow(kind);
    setStartDate(next.start);
    setEndDate(next.end);
  };

  const submit = async () => {
    setMessage(null);
    try {
      await onPublish({
        playerId: player?.id ?? '',
        headline,
        periodKind,
        startDate,
        endDate,
      });
      setHeadline('');
      setMessage('Spotlight published. Fans will see it on Home and the Spotlight tab.');
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : 'Could not publish this award.');
    }
  };

  return (
    <View style={styles.panel}>
      <Text style={styles.title}>Override</Text>
      <Text style={styles.lede}>
        Lock this window to a specific athlete. Hype will not recrown until you tap Let hype decide.
      </Text>

      <Text style={styles.label}>Athlete</Text>
      {player ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Change athlete, ${player.name}`}
          onPress={() => setPlayer(null)}
          style={styles.selected}
        >
          <Text style={styles.selectedName}>{player.name}</Text>
          <Text style={styles.selectedMeta}>{player.school_name || 'Tap to change'}</Text>
        </Pressable>
      ) : (
        <>
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search athletes"
            placeholderTextColor={colors.textMuted}
            autoCapitalize="none"
            autoCorrect={false}
            accessibilityLabel="Search athletes"
            style={styles.field}
          />
          {matches.map((item) => (
            <Pressable
              key={item.id}
              accessibilityRole="button"
              accessibilityLabel={`Select ${item.name}`}
              onPress={() => {
                setPlayer(item);
                setQuery('');
              }}
              style={styles.hit}
            >
              <Text style={styles.hitName}>{item.name}</Text>
              <Text style={styles.hitMeta}>{item.school_name}</Text>
            </Pressable>
          ))}
        </>
      )}

      <Text style={styles.label}>Performance headline</Text>
      <TextInput
        value={headline}
        onChangeText={setHeadline}
        placeholder="4 Touchdowns & 12 Tackles"
        placeholderTextColor={colors.textMuted}
        accessibilityLabel="Performance headline"
        style={styles.field}
      />

      <Text style={styles.label}>Award</Text>
      <View style={styles.periodRow}>
        {(['week', 'month', 'year'] as const).map((kind) => {
          const on = periodKind === kind;
          const label = kind === 'year' ? 'Year' : kind === 'month' ? 'Month' : 'Week';
          return (
            <AnimatedButton
              key={kind}
              haptic="selection"
              accessibilityRole="tab"
              accessibilityState={{ selected: on }}
              accessibilityLabel={`Player of the ${label}`}
              contentStyle={[styles.period, on && styles.periodOn]}
              onPress={() => applyPeriod(kind)}
            >
              <Text style={[styles.periodLabel, on && styles.periodLabelOn]}>{label}</Text>
            </AnimatedButton>
          );
        })}
      </View>

      <View style={styles.dates}>
        <View style={styles.dateCol}>
          <Text style={styles.label}>Start</Text>
          <TextInput
            value={startDate}
            onChangeText={setStartDate}
            placeholder="YYYY-MM-DD"
            placeholderTextColor={colors.textMuted}
            autoCapitalize="none"
            autoCorrect={false}
            accessibilityLabel="Start date"
            style={styles.field}
          />
        </View>
        <View style={styles.dateCol}>
          <Text style={styles.label}>End</Text>
          <TextInput
            value={endDate}
            onChangeText={setEndDate}
            placeholder="YYYY-MM-DD"
            placeholderTextColor={colors.textMuted}
            autoCapitalize="none"
            autoCorrect={false}
            accessibilityLabel="End date"
            style={styles.field}
          />
        </View>
      </View>

      <AnimatedButton
        haptic="medium"
        disabled={busy}
        accessibilityLabel="Publish Spotlight award"
        contentStyle={[styles.publish, busy && styles.disabled]}
        onPress={() => void submit()}
      >
        {busy ? (
          <ActivityIndicator color={FOCAL.backgroundBase} />
        ) : (
          <Text style={styles.publishLabel}>Publish award</Text>
        )}
      </AnimatedButton>
      {message ? <Text style={styles.message}>{message}</Text> : null}

      <Text style={styles.subhead}>Recent awards</Text>
      {awards.length === 0 ? (
        <Text style={styles.empty}>No Spotlight awards yet.</Text>
      ) : (
        awards.map((award) => (
          <View key={award.id} style={styles.award}>
            <Text style={styles.awardTitle}>{award.player?.name || 'Athlete'}</Text>
            <Text style={styles.awardMeta}>
              {spotlightWindowLabel(award)} · {award.headline}
            </Text>
          </View>
        ))
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
  label: {
    color: FOCAL.neonJade,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginTop: 6,
  },
  field: {
    minHeight: 44,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: FOCAL.backgroundBase,
    color: colors.text,
    paddingHorizontal: 12,
    fontSize: 15,
    fontWeight: '700',
  },
  selected: {
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: FOCAL.neonJade,
    backgroundColor: FOCAL.backgroundBase,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 2,
  },
  selectedName: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '800',
  },
  selectedMeta: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '600',
  },
  hit: {
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: FOCAL.backgroundBase,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 2,
  },
  hitName: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '800',
  },
  hitMeta: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '600',
  },
  periodRow: {
    flexDirection: 'row',
    gap: 8,
  },
  period: {
    flex: 1,
    minHeight: 40,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: FOCAL.backgroundBase,
  },
  periodOn: {
    backgroundColor: FOCAL.neonJade,
    borderColor: FOCAL.neonJade,
  },
  periodLabel: {
    color: colors.textMuted,
    fontSize: 14,
    fontWeight: '800',
  },
  periodLabelOn: {
    color: FOCAL.backgroundBase,
  },
  dates: {
    flexDirection: 'row',
    gap: 10,
  },
  dateCol: {
    flex: 1,
    gap: 6,
  },
  publish: {
    minHeight: 48,
    borderRadius: radii.md,
    backgroundColor: FOCAL.neonJade,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  publishLabel: {
    color: FOCAL.backgroundBase,
    fontSize: 15,
    fontWeight: '800',
  },
  disabled: {
    opacity: 0.6,
  },
  message: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '700',
  },
  subhead: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '800',
    marginTop: 8,
  },
  empty: {
    color: colors.textMuted,
    fontSize: 14,
    fontWeight: '600',
  },
  award: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 10,
    gap: 2,
  },
  awardTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '800',
  },
  awardMeta: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '600',
  },
});

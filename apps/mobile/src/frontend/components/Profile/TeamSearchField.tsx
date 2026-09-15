import { ActivityIndicator, StyleSheet, Text, TextInput, View } from 'react-native';

import { HapticPressable as Pressable } from '@/components/UI/HapticPressable';
import { colors, radii } from '@/constants/theme';
import { formatTeamBadge, formatTeamTitle, type SchoolTeam } from '@/data/teams';
import { useTeamSearch } from '@/hooks/useTeamSearch';
import { FOCAL } from '@/theme/motion';

type TeamSearchFieldProps = {
  query: string;
  onQueryChange: (value: string) => void;
  selected: SchoolTeam | null;
  onSelect: (team: SchoolTeam) => void;
  onClear: () => void;
};

/**
 * @purpose Unified High School + NCAA autocomplete for Athlete onboarding.
 * @param query Live search string (`ILIKE %query%` via `useTeamSearch`).
 * @param selected Chosen `schools_and_teams` row; hides the result list.
 * @returns Search field plus level badges (`[ High School • UT ]` / `[ NCAA D1 • Big 12 ]`).
 * @sideEffects Debounced Supabase team search.
 */
export function TeamSearchField({ query, onQueryChange, selected, onSelect, onClear }: TeamSearchFieldProps) {
  const { teams, loading } = useTeamSearch(selected ? '' : query);
  const showList = !selected && query.trim().length > 0;

  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>Team</Text>
      {selected ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Change team, ${formatTeamTitle(selected)}`}
          onPress={onClear}
          style={styles.selected}
        >
          <View style={styles.selectedCopy}>
            <Text style={styles.selectedTitle}>{formatTeamTitle(selected)}</Text>
            <Text style={styles.badge}>{formatTeamBadge(selected)}</Text>
          </View>
          <Text style={styles.change}>Change</Text>
        </Pressable>
      ) : (
        <TextInput
          value={query}
          onChangeText={onQueryChange}
          autoCorrect={false}
          autoCapitalize="words"
          placeholder="Search high school or university"
          placeholderTextColor={colors.textMuted}
          accessibilityLabel="Search high school or university"
          style={styles.input}
        />
      )}
      {showList ? (
        <View style={styles.list} accessibilityRole="list">
          {loading ? <ActivityIndicator color={FOCAL.jadeInk} style={styles.spinner} /> : null}
          {teams.map((team) => (
            <Pressable
              key={team.id}
              accessibilityRole="button"
              accessibilityLabel={`${formatTeamTitle(team)} ${formatTeamBadge(team)}`}
              haptic="medium"
              onPress={() => onSelect(team)}
              style={({ pressed }) => [styles.row, pressed && styles.pressed]}
            >
              <View style={styles.rowCopy}>
                <Text style={styles.rowTitle}>{formatTeamTitle(team)}</Text>
                {team.city ? <Text style={styles.rowCity}>{team.city}</Text> : null}
              </View>
              <Text style={styles.badge}>{formatTeamBadge(team)}</Text>
            </Pressable>
          ))}
          {!loading && teams.length === 0 ? (
            <Text style={styles.empty}>No teams match that search.</Text>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: 8,
  },
  label: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  input: {
    minHeight: 48,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    color: colors.text,
    fontSize: 15,
    fontWeight: '700',
    paddingHorizontal: 12,
  },
  selected: {
    minHeight: 52,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: FOCAL.jadeInk,
    backgroundColor: colors.accentSoft,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  selectedCopy: {
    flex: 1,
    gap: 4,
  },
  selectedTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '800',
  },
  change: {
    color: FOCAL.jadeInk,
    fontSize: 12,
    fontWeight: '800',
  },
  list: {
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    overflow: 'hidden',
    maxHeight: 220,
  },
  spinner: {
    paddingVertical: 10,
  },
  row: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  rowCopy: {
    flex: 1,
    gap: 2,
  },
  rowTitle: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '800',
  },
  rowCity: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '600',
  },
  badge: {
    color: FOCAL.jadeInk,
    fontSize: 11,
    fontWeight: '800',
  },
  empty: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '600',
    padding: 12,
  },
  pressed: {
    opacity: 0.88,
  },
});

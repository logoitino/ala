import { useCallback, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { type Href, useFocusEffect, useRouter } from 'expo-router';

import {
  AdminBtn,
  AdminEmpty,
  AdminField,
  AdminNotice,
  AdminPage,
  AdminPanel,
  AdminPills,
  AdminRow,
  AdminSuggest,
} from '@/components/Admin/AdminChrome';
import { colors } from '@/constants/theme';
import { formatTeamBadge, type SchoolTeam } from '@/data/teams';
import { fetchAdminPolls, fetchAdminSchools, resetAdminPollVotes, slugify, upsertAdminPoll } from '@/lib/adminCatalog';
import { FOCAL } from '@/theme/motion';
import type { CheerPoll } from '@/types/database';

const empty = {
  slug: '',
  home_label: '',
  away_label: '',
  is_active: true,
};

type PollFilter = 'live' | 'hidden' | 'all';

/**
 * @purpose School Polls desk with live share bars, school pickers, hide/show, reset votes.
 * @sideEffects `upsert_cheer_poll`; `cheer_polls` UPDATE.
 */
export function PollsTool() {
  const router = useRouter();
  const [rows, setRows] = useState<CheerPoll[]>([]);
  const [schools, setSchools] = useState<SchoolTeam[]>([]);
  const [form, setForm] = useState(empty);
  const [filter, setFilter] = useState<PollFilter>('live');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [nextRows, nextSchools] = await Promise.all([fetchAdminPolls(), fetchAdminSchools()]);
      setRows(nextRows);
      setSchools(nextSchools);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not load polls.');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );

  const schoolOptions = useMemo(
    () =>
      schools.map((row) => ({
        id: row.id,
        title: row.mascot ? `${row.name.replace(/ High$/, '')} ${row.mascot}` : row.name,
        meta: formatTeamBadge(row),
      })),
    [schools],
  );

  const visible = useMemo(() => {
    if (filter === 'live') return rows.filter((row) => row.is_active !== false);
    if (filter === 'hidden') return rows.filter((row) => row.is_active === false);
    return rows;
  }, [filter, rows]);

  const save = async (row = form) => {
    setBusy(true);
    setMessage(null);
    try {
      await upsertAdminPoll({
        slug: row.slug || slugify(`${row.home_label}-${row.away_label}`),
        home_label: row.home_label,
        away_label: row.away_label,
        is_active: row.is_active,
      });
      setForm(empty);
      setMessage(row.is_active === false ? 'Hidden from Local.' : 'On Local School Polls.');
      await refresh();
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : 'Could not save this poll.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <AdminPage
      title="Polls"
      lede="Active polls drive Local School Polls. Labels here are what fans cheer."
      refreshing={loading}
      onRefresh={() => void refresh()}
      error={error}
      saveMode="instant"
    >
      <AdminBtn label="View Local polls" onPress={() => router.push('/local' as Href)} />
      <AdminPills
        label="Board"
        items={[
          { id: 'live', label: 'On Local' },
          { id: 'hidden', label: 'Hidden' },
          { id: 'all', label: 'All' },
        ]}
        value={filter}
        onChange={setFilter}
      />
      <AdminPanel title={form.slug ? 'Edit poll' : 'New poll'}>
        <AdminSuggest
          label="Home"
          value={form.home_label}
          onChangeText={(home_label) => setForm((c) => ({ ...c, home_label }))}
          options={schoolOptions}
          placeholder="Westlake Thunder"
          onPick={(option) => setForm((c) => ({ ...c, home_label: option.title }))}
        />
        <AdminSuggest
          label="Away"
          value={form.away_label}
          onChangeText={(away_label) => setForm((c) => ({ ...c, away_label }))}
          options={schoolOptions}
          placeholder="Lone Peak Knights"
          onPick={(option) => setForm((c) => ({ ...c, away_label: option.title }))}
        />
        <AdminField label="Slug" value={form.slug} onChangeText={(slug) => setForm((c) => ({ ...c, slug }))} placeholder="westlake-lone-peak" />
        <AdminBtn label={busy ? 'Saving…' : 'Save poll'} kind="primary" disabled={busy} onPress={() => void save({ ...form, is_active: true })} />
        {form.slug ? <AdminBtn label="Clear form" onPress={() => setForm(empty)} /> : null}
        <AdminNotice text={message} />
      </AdminPanel>
      {visible.length === 0 ? (
        <AdminEmpty text="No polls in this board." />
      ) : (
        visible.map((row) => {
          const total = Math.max(1, (row.home_votes ?? 0) + (row.away_votes ?? 0));
          const homePct = Math.round(((row.home_votes ?? 0) / total) * 100);
          return (
            <View key={row.slug} style={styles.card}>
              <AdminRow
                title={`${row.home_label} vs ${row.away_label}`}
                meta={`${row.home_votes}–${row.away_votes} · ${row.is_active === false ? 'Hidden' : 'On Local'}`}
              >
                <AdminBtn
                  label="Edit"
                  onPress={() =>
                    setForm({
                      slug: row.slug,
                      home_label: row.home_label,
                      away_label: row.away_label,
                      is_active: row.is_active !== false,
                    })
                  }
                />
                <AdminBtn
                  label={row.is_active === false ? 'Show' : 'Hide'}
                  onPress={() =>
                    void save({
                      slug: row.slug,
                      home_label: row.home_label,
                      away_label: row.away_label,
                      is_active: row.is_active === false,
                    })
                  }
                />
                <AdminBtn label="Reset votes" kind="danger" onPress={() => void resetAdminPollVotes(row.slug).then(refresh)} />
              </AdminRow>
              <View style={styles.bar} accessibilityLabel={`${homePct} percent home`}>
                <View style={[styles.homeFill, { flex: Math.max(row.home_votes, 0.15) }]} />
                <View style={[styles.awayFill, { flex: Math.max(row.away_votes, 0.15) }]} />
              </View>
              <Text style={styles.barLabel}>
                {row.home_label} {homePct}%
              </Text>
            </View>
          );
        })
      )}
    </AdminPage>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: 8,
  },
  bar: {
    height: 8,
    borderRadius: 999,
    overflow: 'hidden',
    flexDirection: 'row',
    backgroundColor: colors.border,
  },
  homeFill: {
    backgroundColor: FOCAL.neonJade,
  },
  awayFill: {
    backgroundColor: colors.border,
  },
  barLabel: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '700',
  },
});

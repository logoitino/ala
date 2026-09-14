import { useCallback, useMemo, useState } from 'react';
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
import { formatTeamBadge, type SchoolTeam } from '@/data/teams';
import { fetchAdminGames, fetchAdminSchools, upsertGame } from '@/lib/adminCatalog';
import { useAuth } from '@/context/AuthContext';
import { updateGameScore } from '@/lib/operator';
import type { Game } from '@/types/database';

const empty = {
  id: '',
  home_team: '',
  away_team: '',
  home_school: '',
  away_school: '',
  venue: '',
  quarter: 'Q1',
  clock: '12:00',
  home_score: '0',
  away_score: '0',
};

const QUARTERS = [
  { id: 'Q1', label: 'Q1' },
  { id: 'Q2', label: 'Q2' },
  { id: 'Q3', label: 'Q3' },
  { id: 'Q3b', label: 'Half' },
  { id: 'Q4', label: 'Q4' },
  { id: 'Final', label: 'Final' },
] as const;

type BoardFilter = 'live' | 'parked' | 'all';

function quarterValue(raw: string): (typeof QUARTERS)[number]['id'] {
  if (raw === 'Halftime' || raw === 'Q3b') return 'Q3b';
  if (raw === 'Final') return 'Final';
  if (raw === 'Q2' || raw === 'Q3' || raw === 'Q4') return raw;
  return 'Q1';
}

function quarterPersist(id: string): string {
  return id === 'Q3b' ? 'Halftime' : id;
}

/**
 * @purpose Run the Local match board: school pickers, quarter chips, live +1, park / go live.
 * @sideEffects `games` INSERT / UPDATE; `update_game_score` for score nudges.
 */
export function GamesTool() {
  const router = useRouter();
  const { previewAsRole } = useAuth();
  const [rows, setRows] = useState<Game[]>([]);
  const [schools, setSchools] = useState<SchoolTeam[]>([]);
  const [form, setForm] = useState(empty);
  const [filter, setFilter] = useState<BoardFilter>('live');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [nudgeId, setNudgeId] = useState<string | null>(null);

  const schoolOptions = useMemo(
    () => schools.map((row) => ({ id: row.id, title: row.name, meta: `${row.mascot} · ${formatTeamBadge(row)}` })),
    [schools],
  );

  const visible = useMemo(() => {
    if (filter === 'live') return rows.filter((game) => game.is_active !== false);
    if (filter === 'parked') return rows.filter((game) => game.is_active === false);
    return rows;
  }, [filter, rows]);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [nextGames, nextSchools] = await Promise.all([fetchAdminGames(), fetchAdminSchools()]);
      setRows(nextGames);
      setSchools(nextSchools);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not load games.');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );

  const persist = async (extra?: Partial<Game>) => {
    setBusy(true);
    setMessage(null);
    try {
      await upsertGame({
        id: form.id || extra?.id || undefined,
        home_team: extra?.home_team ?? form.home_team,
        away_team: extra?.away_team ?? form.away_team,
        home_school: extra?.home_school ?? form.home_school,
        away_school: extra?.away_school ?? form.away_school,
        venue: extra?.venue ?? form.venue,
        quarter: extra?.quarter ?? form.quarter,
        clock: extra?.clock ?? form.clock,
        home_score: extra?.home_score ?? (Number(form.home_score) || 0),
        away_score: extra?.away_score ?? (Number(form.away_score) || 0),
        is_active: extra?.is_active,
        status: extra?.status,
      });
      if (!extra?.id || extra.id === form.id) setForm(empty);
      setMessage(extra?.is_active === false ? 'Parked. Off Local.' : 'Match is live on Local.');
      await refresh();
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : 'Could not save this game.');
    } finally {
      setBusy(false);
    }
  };

  const nudge = async (game: Game, side: 'home' | 'away') => {
    setNudgeId(game.id);
    try {
      await updateGameScore({
        game,
        homeDelta: side === 'home' ? 1 : 0,
        awayDelta: side === 'away' ? 1 : 0,
      });
      await refresh();
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : 'Could not bump this score.');
    } finally {
      setNudgeId(null);
    }
  };

  const pickSchool = (side: 'home' | 'away', option: { title: string; meta?: string }) => {
    const mascot = option.meta?.split(' · ')[0] ?? option.title;
    if (side === 'home') {
      setForm((current) => ({ ...current, home_school: option.title, home_team: mascot || option.title }));
    } else {
      setForm((current) => ({ ...current, away_school: option.title, away_team: mascot || option.title }));
    }
  };

  return (
    <AdminPage
      title="Live games"
      lede="Active matches are the Local board and operator console. Nudge a score here and fans see it live."
      refreshing={loading}
      onRefresh={() => void refresh()}
      error={error}
      saveMode="instant"
    >
      <AdminPills
        label="Board"
        items={[
          { id: 'live', label: `Live (${rows.filter((g) => g.is_active !== false).length})` },
          { id: 'parked', label: 'Parked' },
          { id: 'all', label: 'All' },
        ]}
        value={filter}
        onChange={setFilter}
      />
      <AdminPanel title={form.id ? 'Edit match' : 'New match'}>
        <AdminSuggest
          label="Home school"
          value={form.home_school}
          onChangeText={(home_school) => setForm((c) => ({ ...c, home_school, home_team: c.home_team || home_school }))}
          options={schoolOptions}
          placeholder="Westlake High"
          onPick={(option) => pickSchool('home', option)}
        />
        <AdminSuggest
          label="Away school"
          value={form.away_school}
          onChangeText={(away_school) => setForm((c) => ({ ...c, away_school, away_team: c.away_team || away_school }))}
          options={schoolOptions}
          placeholder="Lone Peak High"
          onPick={(option) => pickSchool('away', option)}
        />
        <AdminField label="Home name on the board" value={form.home_team} onChangeText={(home_team) => setForm((c) => ({ ...c, home_team }))} placeholder="Thunder" />
        <AdminField label="Away name on the board" value={form.away_team} onChangeText={(away_team) => setForm((c) => ({ ...c, away_team }))} placeholder="Knights" />
        <AdminField label="Venue" value={form.venue} onChangeText={(venue) => setForm((c) => ({ ...c, venue }))} placeholder="Westlake Stadium" />
        <AdminPills
          label="Period"
          items={[...QUARTERS]}
          value={quarterValue(form.quarter)}
          onChange={(id) => setForm((c) => ({ ...c, quarter: quarterPersist(id) }))}
        />
        <AdminField label="Clock" value={form.clock} onChangeText={(clock) => setForm((c) => ({ ...c, clock }))} />
        <AdminBtn
          label={busy ? 'Saving…' : form.id ? 'Save match' : 'Go live on Local'}
          kind="primary"
          disabled={busy}
          onPress={() => void persist({ is_active: true, status: form.quarter === 'Final' ? 'Final' : 'live' })}
        />
        {form.id ? <AdminBtn label="Clear form" onPress={() => setForm(empty)} /> : null}
        <AdminNotice text={message} />
      </AdminPanel>
      {visible.length === 0 ? (
        <AdminEmpty text={filter === 'live' ? 'Nothing live. Publish a match to fill Local.' : 'No parked matches.'} />
      ) : (
        visible.map((game) => (
          <AdminRow
            key={game.id}
            title={`${game.home_team} ${game.home_score} – ${game.away_score} ${game.away_team}`}
            meta={`${game.home_school || game.home_team} vs ${game.away_school || game.away_team} · ${game.quarter || game.status} ${game.clock || ''} · ${game.is_active ? 'On Local' : 'Parked'}`}
          >
            {game.is_active ? (
              <>
                <AdminBtn label={`${game.home_team} +1`} disabled={nudgeId === game.id} onPress={() => void nudge(game, 'home')} />
                <AdminBtn label={`${game.away_team} +1`} disabled={nudgeId === game.id} onPress={() => void nudge(game, 'away')} />
              </>
            ) : null}
            <AdminBtn
              label="Edit"
              onPress={() =>
                setForm({
                  id: game.id,
                  home_team: game.home_team,
                  away_team: game.away_team,
                  home_school: game.home_school,
                  away_school: game.away_school,
                  venue: game.venue,
                  quarter: game.quarter || 'Q1',
                  clock: game.clock || '12:00',
                  home_score: String(game.home_score),
                  away_score: String(game.away_score),
                })
              }
            />
            <AdminBtn
              label={game.is_active ? 'Park' : 'Go live'}
              kind={game.is_active ? 'ghost' : 'primary'}
              onPress={() =>
                void persist({
                  id: game.id,
                  home_team: game.home_team,
                  away_team: game.away_team,
                  home_school: game.home_school,
                  away_school: game.away_school,
                  venue: game.venue,
                  quarter: game.quarter || 'Q1',
                  clock: game.clock || '12:00',
                  home_score: game.home_score,
                  away_score: game.away_score,
                  is_active: !game.is_active,
                  status: game.is_active ? 'Final' : 'live',
                })
              }
            />
            <AdminBtn label="Local" onPress={() => router.push(`/local/game/${game.id}` as Href)} />
            <AdminBtn
              label="Operator"
              onPress={() => {
                void previewAsRole('operator').then(() => router.push(`/operator/${game.id}` as Href));
              }}
            />
          </AdminRow>
        ))
      )}
    </AdminPage>
  );
}

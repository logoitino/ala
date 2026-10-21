/** LOCAL-02: the Games desk owns public venue details; each match can use a neutral venue and clear its address to remove directions. */
import { useCallback, useMemo, useState } from 'react';
import { type Href, useFocusEffect, useRouter } from 'expo-router';

import { OperatorCheckinsPanel } from '@/components/Admin/OperatorCheckinsPanel';
import {
  AdminBtn,
  AdminEmpty,
  AdminField,
  AdminFieldRow,
  AdminNotice,
  AdminPage,
  AdminPanel,
  AdminPills,
  AdminRow,
  AdminSuggest,
} from '@/components/Admin/AdminChrome';
import { formatTeamBadge, type SchoolTeam } from '@/data/teams';
import { sportClockLabel } from '@/data/sports';
import { useSportConfigs } from '@/hooks/useSportConfigs';
import { useAdminAction } from '@/hooks/useAdminAction';
import { fetchAdminGames, fetchAdminSchools, upsertGame } from '@/lib/adminCatalog';
import { useAuth } from '@/context/AuthContext';
import { updateGameScore } from '@/lib/operator';
import type { Game } from '@/types/database';

const empty = {
  id: '',
  sport: 'Football',
  home_team: '',
  away_team: '',
  home_school: '',
  away_school: '',
  venue: '',
  venue_school: '',
  venue_address: '',
  venue_notes: '',
  quarter: 'Q1',
  clock: '12:00',
  home_score: '0',
  away_score: '0',
};

type BoardFilter = 'live' | 'parked' | 'all';

/**
 * @purpose Run the Local match board: sport picker, school pickers, period chips from that sport's playbook, live +1, park / go live.
 * @sideEffects `games` INSERT / UPDATE (including `games.sport`); `get_sport_configs`; `update_game_score` for score nudges.
 */
export function GamesTool() {
  const router = useRouter();
  const { previewAsRole } = useAuth();
  const { configs, configFor } = useSportConfigs();
  const [rows, setRows] = useState<Game[]>([]);
  const [schools, setSchools] = useState<SchoolTeam[]>([]);
  const [form, setForm] = useState(empty);
  const [filter, setFilter] = useState<BoardFilter>('live');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const schoolOptions = useMemo(
    () => schools.map((row) => ({ id: row.id, title: row.name, meta: `${row.mascot} · ${formatTeamBadge(row)}` })),
    [schools],
  );

  const formPlaybook = configFor(form.sport);

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

  const { busy, message, run } = useAdminAction(refresh);

  const persist = async (extra?: Partial<Game>) => {
    await run('save', async () => {
      const source = rows.find((game) => game.id === form.id);
      const venueFields: Partial<Game> = {};
      for (const field of ['venue_school', 'venue_address', 'venue_notes'] as const) {
        if (extra?.id) {
          // Row actions preserve that row's destination, even while a different draft is being edited.
          if (extra[field] !== undefined) venueFields[field] = extra[field];
        } else if (form[field].trim() || source?.[field] !== undefined || rows.some((game) => game[field] !== undefined)) {
          venueFields[field] = form[field];
        }
      }
      await upsertGame({
        id: extra?.id || form.id || undefined,
        sport: extra?.sport ?? form.sport,
        home_team: extra?.home_team ?? form.home_team,
        away_team: extra?.away_team ?? form.away_team,
        home_school: extra?.home_school ?? form.home_school,
        away_school: extra?.away_school ?? form.away_school,
        venue: extra?.venue ?? form.venue,
        ...venueFields,
        quarter: extra?.quarter ?? form.quarter,
        clock: extra?.clock ?? form.clock,
        home_score: extra?.home_score ?? (Number(form.home_score) || 0),
        away_score: extra?.away_score ?? (Number(form.away_score) || 0),
        is_active: extra?.is_active,
        status: extra?.status,
      });
      if (!extra?.id || extra.id === form.id) setForm(empty);
      return extra?.is_active === false ? 'Parked. Off Local.' : 'Match is live on Local.';
    }, 'Could not save this game.');
  };

  const nudge = async (game: Game, side: 'home' | 'away') => {
    await run('score', async () => {
      await updateGameScore({
        game,
        homeDelta: side === 'home' ? 1 : 0,
        awayDelta: side === 'away' ? 1 : 0,
      });
      return 'Score updated.';
    }, 'Could not bump this score.');
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
        <AdminFieldRow>
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
        </AdminFieldRow>
        <AdminFieldRow>
          <AdminField label="Home name on the board" value={form.home_team} onChangeText={(home_team) => setForm((c) => ({ ...c, home_team }))} placeholder="Thunder" />
          <AdminField label="Away name on the board" value={form.away_team} onChangeText={(away_team) => setForm((c) => ({ ...c, away_team }))} placeholder="Knights" />
        </AdminFieldRow>
        <AdminField label="Stadium, gym or field" value={form.venue} onChangeText={(venue) => setForm((c) => ({ ...c, venue }))} placeholder="Westlake Stadium" editable={!busy} />
        <AdminField label="Venue school (optional)" value={form.venue_school} onChangeText={(venue_school) => setForm((c) => ({ ...c, venue_school }))} placeholder="School where this game is played" editable={!busy} />
        <AdminField label="Venue address" value={form.venue_address} onChangeText={(venue_address) => setForm((c) => ({ ...c, venue_address }))} placeholder="Street address, city, state and ZIP" multiline editable={!busy} />
        <AdminField label="Arrival note (optional)" value={form.venue_notes} onChangeText={(venue_notes) => setForm((c) => ({ ...c, venue_notes }))} placeholder="Use the east entrance; visitor parking nearby" multiline editable={!busy} />
        <AdminNotice text="Use the public sporting venue address, including away and tournament venues. Clear the address to remove directions. These details are visible to fans." />
        <AdminPills
          label="Sport"
          items={configs
            .filter((row) => row.isActive)
            .map((row) => ({ id: row.sport, label: `${row.emoji} ${row.sport}` }))}
          value={form.sport}
          onChange={(sport) => {
            const playbook = configFor(sport);
            setForm((c) => ({
              ...c,
              sport,
              quarter: playbook.periods[0] ?? c.quarter,
              clock: sportClockLabel(playbook) || c.clock,
            }));
          }}
        />
        <AdminPills
          label={formPlaybook.periodLabel}
          items={[...formPlaybook.periods, 'Final'].map((id) => ({ id, label: id }))}
          value={form.quarter}
          onChange={(quarter) => setForm((c) => ({ ...c, quarter }))}
        />
        {formPlaybook.usesClock ? (
          <AdminField label="Clock" value={form.clock} onChangeText={(clock) => setForm((c) => ({ ...c, clock }))} />
        ) : null}
        <AdminBtn
          label={busy === 'save' ? 'Saving…' : form.id ? 'Save match' : 'Go live on Local'}
          kind="primary"
          disabled={busy !== null}
          onPress={() => void persist({ is_active: true, status: form.quarter === 'Final' ? 'Final' : 'live' })}
        />
        {form.id ? <AdminBtn label="Clear form" disabled={busy !== null} onPress={() => setForm(empty)} /> : null}
        <AdminNotice text={message?.text ?? null} tone={message?.tone} />
      </AdminPanel>
      {visible.length === 0 ? (
        <AdminEmpty text={filter === 'live' ? 'Nothing live. Publish a match to fill Local.' : 'No parked matches.'} />
      ) : (
        visible.map((game) => (
          <AdminRow
            key={game.id}
            title={`${game.home_team} ${game.home_score} – ${game.away_score} ${game.away_team}`}
            meta={`${configFor(game.sport).emoji} ${game.sport || 'Football'} · ${game.home_school || game.home_team} vs ${game.away_school || game.away_team} · ${game.quarter || game.status} ${game.clock || ''} · ${game.is_active ? 'On Local' : 'Parked'} · ${game.venue?.trim() || 'Venue TBA'}${game.venue_school?.trim() ? ` · ${game.venue_school.trim()}` : ''} · ${game.venue_address?.trim() || 'Address TBA'}${game.venue_notes?.trim() ? ` · ${game.venue_notes.trim()}` : ''}`}
          >
            {game.is_active ? (
              <>
                <AdminBtn label={`${game.home_team} +1`} disabled={busy !== null} onPress={() => void nudge(game, 'home')} />
                <AdminBtn label={`${game.away_team} +1`} disabled={busy !== null} onPress={() => void nudge(game, 'away')} />
              </>
            ) : null}
            <AdminBtn
              label="Edit"
              disabled={busy !== null}
              onPress={() =>
                setForm({
                  id: game.id,
                  sport: game.sport || 'Football',
                  home_team: game.home_team,
                  away_team: game.away_team,
                  home_school: game.home_school,
                  away_school: game.away_school,
                  venue: game.venue,
                  venue_school: game.venue_school ?? '',
                  venue_address: game.venue_address ?? '',
                  venue_notes: game.venue_notes ?? '',
                  quarter: game.quarter || 'Q1',
                  clock: game.clock || '12:00',
                  home_score: String(game.home_score),
                  away_score: String(game.away_score),
                })
              }
            />
            <AdminBtn
              label={game.is_active ? 'Park' : 'Go live'}
              disabled={busy !== null}
              kind={game.is_active ? 'ghost' : 'primary'}
              onPress={() =>
                void persist({
                  id: game.id,
                  sport: game.sport || 'Football',
                  home_team: game.home_team,
                  away_team: game.away_team,
                  home_school: game.home_school,
                  away_school: game.away_school,
                  venue: game.venue,
                  venue_school: game.venue_school,
                  venue_address: game.venue_address,
                  venue_notes: game.venue_notes,
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
      <OperatorCheckinsPanel />
    </AdminPage>
  );
}

/** DATA-01 closures: admin wrappers send the RPC arguments the migration defines, map rows without
 * token hashes or precise GPS, and report a missing migration as "not switched on". Synthetic data. */
const mockRpc = jest.fn();
const mockFrom = jest.fn();
jest.mock('@/lib/supabase', () => ({ isSupabaseConfigured: true, supabase: { rpc: (...args: unknown[]) => mockRpc(...args), from: (...args: unknown[]) => mockFrom(...args) } }));

import {
  NOT_SWITCHED_ON, addGameLog, addSchoolConfirmer, fetchOperatorCheckins, fetchSchoolConfirmers, purgeOperatorCheckins,
  removeGameLog, revokeVerification, saveCareerStats, setCustodialTerms, setSchoolBranding,
} from '@/lib/adminControls';
import * as controls from '@/lib/adminControls';
import { clearMyCrewAlerts, fetchMyCrewAlerts } from '@/lib/crew';

beforeEach(() => { mockRpc.mockReset().mockResolvedValue({ data: null, error: null }); mockFrom.mockReset(); });

it('sends the exact argument names each RPC expects', async () => {
  await saveCareerStats({ playerId: 'p1', sport: 'Rugby', gamesPlayed: 8, scoringValue: 40, volumeValue: 120, mvpBadges: 2 });
  expect(mockRpc).toHaveBeenLastCalledWith('admin_upsert_athlete_career_stats', { p_player_id: 'p1', p_sport: 'Rugby', p_games_played: 8, p_scoring_value: 40, p_volume_value: 120, p_mvp_badges: 2 });
  mockRpc.mockResolvedValueOnce({ data: 'log-1', error: null });
  await expect(addGameLog({ playerId: 'p1', playedOn: '2026-10-02', opponent: 'Kahuku', statLine: '2 tries', scoringValue: 10, volumeValue: 30 })).resolves.toBe('log-1');
  await removeGameLog('log-1');
  expect(mockRpc).toHaveBeenLastCalledWith('admin_remove_athlete_game_log', { p_log_id: 'log-1' });
  await setSchoolBranding({ schoolId: 's1', logoUrl: '', colorPrimary: '#1D3F8F', colorSecondary: null });
  expect(mockRpc).toHaveBeenLastCalledWith('admin_set_school_branding', { target_school_id: 's1', new_logo_url: null, new_color_primary: '#1D3F8F', new_color_secondary: null });
  await revokeVerification('u1', 'Wrong school');
  expect(mockRpc).toHaveBeenLastCalledWith('admin_revoke_verification', { target_profile_id: 'u1', note: 'Wrong school' });
  await setCustodialTerms({ playerId: 'p1', handoverAge: 21, birthDate: null });
  expect(mockRpc).toHaveBeenLastCalledWith('admin_set_custodial_terms', { target_player_id: 'p1', new_handover_age: 21, corrected_birth_date: null });
});

it('maps check-ins with rounded location and confirmers without tokens', async () => {
  mockRpc.mockResolvedValueOnce({ data: [{ id: 'c1', gig_id: null, checked_in_at: '2026-10-12T18:00:00Z', latitude_approx: 21.31, longitude_approx: -157.86 }], error: null });
  await expect(fetchOperatorCheckins(5)).resolves.toEqual([{ id: 'c1', gigId: null, checkedInAt: '2026-10-12T18:00:00Z', latitudeApprox: 21.31, longitudeApprox: -157.86 }]);
  mockRpc.mockResolvedValueOnce({ data: 3, error: null });
  await expect(purgeOperatorCheckins(90)).resolves.toBe(3);
  mockRpc.mockResolvedValueOnce({ data: [{ id: 'k1', full_name: 'Ana Tui', email: 'ana@school.org', staff_role: 'athletic_director', sport: null, active: true, expires_at: '2027-10-01T00:00:00Z', last_used_at: null, token_hash: 'secret-hash' }], error: null });
  const rows = await fetchSchoolConfirmers('s1');
  expect(rows[0]).toEqual(expect.objectContaining({ fullName: 'Ana Tui', active: true }));
  expect(JSON.stringify(rows)).not.toMatch(/token|secret-hash/);
  mockRpc.mockResolvedValueOnce({ data: { id: 'k2', token: 'raw', link: 'alasports://school-confirm?t=raw' }, error: null });
  await expect(addSchoolConfirmer({ schoolId: 's1', name: 'Coach K', email: 'k@school.org', role: 'coach', sport: 'Rugby' })).resolves.toEqual({ id: 'k2', link: 'alasports://school-confirm?t=raw' });
});

it('reports a missing migration as not switched on, and other errors as they are', async () => {
  mockRpc.mockResolvedValueOnce({ data: null, error: { code: 'PGRST202', message: 'Could not find the function' } });
  await expect(purgeOperatorCheckins()).rejects.toThrow(NOT_SWITCHED_ON);
  mockRpc.mockResolvedValueOnce({ data: null, error: { message: 'Keep at least 7 days of check-ins.' } });
  await expect(purgeOperatorCheckins(3)).rejects.toThrow('Keep at least 7 days');
});

it('reads and clears the fan\'s own Crew alerts', async () => {
  const chain = { select: () => chain, order: () => chain, limit: async () => ({ data: [{ id: 'a1', title: 'Flash unlock', body: 'Kaleo opened a clip', reel_id: 'r1', athlete_id: 'p1', created_at: '2026-10-12T00:00:00Z' }], error: null }) };
  mockFrom.mockReturnValue(chain);
  await expect(fetchMyCrewAlerts()).resolves.toEqual([{ id: 'a1', title: 'Flash unlock', body: 'Kaleo opened a clip', reelId: 'r1', athleteId: 'p1', createdAt: '2026-10-12T00:00:00Z' }]);
  expect(mockFrom).toHaveBeenCalledWith('crew_push_queue');
  mockRpc.mockResolvedValueOnce({ data: 1, error: null });
  await expect(clearMyCrewAlerts()).resolves.toBe(1);
  expect(mockRpc).toHaveBeenLastCalledWith('clear_my_crew_alerts', {});
});

it('explicit game-log sport cannot fall back to the old ambiguous writer',async()=>{
 mockRpc.mockResolvedValue({data:'log',error:null});
 await addGameLog({playerId:'p1',sport:'Volleyball',playedOn:'2026-10-02',opponent:'Other',statLine:'3 kills',scoringValue:3,volumeValue:4});
 expect(mockRpc).toHaveBeenCalledWith('admin_add_athlete_game_log',expect.objectContaining({p_sport:'Volleyball'}));
});
it('classification writes the original row with expected old sport',async()=>{
 mockRpc.mockResolvedValue({data:{id:'log1',player_id:'p1',sport:'Volleyball',played_on:'2026-10-02',opponent_school:'Other',stat_line:'3 kills',scoring_value:3,volume_value:4},error:null});
 await expect(controls.classifyGameLogSport('log1','p1','Volleyball',null)).resolves.toMatchObject({id:'log1',statLine:'3 kills'});
 expect(mockRpc).toHaveBeenCalledWith('admin_set_athlete_game_log_sport',{p_log_id:'log1',p_player_id:'p1',p_sport:'Volleyball',p_expected_sport:null});
});

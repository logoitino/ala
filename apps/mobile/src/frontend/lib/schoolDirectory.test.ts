/** Current-record browsing must be bounded, honest about errors and limited to public identity fields. */
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';

let mockConfigured = true;
jest.mock('@/lib/supabase', () => ({ get isSupabaseConfigured() { return mockConfigured; }, supabase: {} }));
type Options = { search?: string; offset?: number; limit?: number };
type Directory = {
  getDirectorySchool: (id: string, client: unknown) => Promise<unknown>;
  listDirectorySchools: (options: Options, client: unknown) => Promise<{ items: unknown[]; hasMore: boolean; nextOffset: number | null }>;
  listDirectoryRoster: (options: Options & { schoolId: string; schoolName: string; team?: string | null }, client: unknown) => Promise<{ items: unknown[]; hasMore: boolean; nextOffset: number | null }>;
};
// Before the new adapter exists, retain an assertion failure for the missing public contract, not a loader error.
let directory: Directory;
try { directory = require('./schoolDirectory') as Directory; } catch (error) {
  if (!String(error).includes("Cannot find module './schoolDirectory'")) throw error;
  directory = {} as Directory;
}
const SCHOOL = '11111111-1111-4111-8111-111111111111';
const PLAYER = '22222222-2222-4222-8222-222222222222';
const school = { id: SCHOOL, name: 'School A', mascot: 'Owls', level: 'high_school', division: 'Varsity', region: 'UT', city: 'Town' };
const player = { id: PLAYER, name: 'Jordan', jersey_number: 7, position: 'Wing', school_name: 'School A', team: 'Girls Rugby' };
let transport: jest.Mock<ReturnType<typeof fetch>, Parameters<typeof fetch>>;
let client: ReturnType<typeof createClient<Database>>;
function response(body: unknown, status = 200) { return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } }); }
function url(n = 0) { return new URL(String(transport.mock.calls[n][0])); }
beforeEach(() => {
  mockConfigured = true;
  transport = jest.fn<ReturnType<typeof fetch>, Parameters<typeof fetch>>(async () => response([]));
  client = createClient<Database>('https://directory.invalid', 'public-test-key', { accessToken: async () => 'test-public-token', auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }, global: { fetch: transport as unknown as typeof fetch } }) as never;
});
it('exposes current-school and bounded catalog/roster readers', () => {
  expect(directory.getDirectorySchool).toEqual(expect.any(Function));
  expect(directory.listDirectorySchools).toEqual(expect.any(Function));
  expect(directory.listDirectoryRoster).toEqual(expect.any(Function));
});
it('returns only safe catalog fields and one bounded page with a continuation sentinel', async () => {
  transport.mockResolvedValueOnce(response([{ ...school, team_code: 'NEVER_RETURN', logo_url: 'extra' }, { ...school, id: PLAYER, name: 'School B' }]));
  expect(await directory.listDirectorySchools({ limit: 1, offset: 4 }, client)).toEqual({ items: [school], hasMore: true, nextOffset: 5 });
  expect(url().searchParams.get('select')).toBe('id,name,mascot,level,division,region,city');
  expect(url().searchParams.get('order')).toBe('name.asc,id.asc');
  expect(url().searchParams.get('offset')).toBe('4');
  expect(url().searchParams.get('limit')).toBe('2');
});
it('treats a genuine empty page as empty rather than substituting demonstration schools', async () => {
  expect(await directory.listDirectorySchools({}, client)).toEqual({ items: [], hasMore: false, nextOffset: null });
  expect(transport).toHaveBeenCalledTimes(1);
});
it('searches literal wildcard characters without widening a name search', async () => {
  await directory.listDirectorySchools({ search: 'A%_\\,()' }, client);
  expect(url().searchParams.get('name')).toBe('ilike.%A\\%\\_\\\\,()%');
  expect(url().searchParams.has('or')).toBe(false);
});
it.each([{}, { code: '42501', message: 'Denied' }, { code: 'PGRST205', message: 'Missing table' }])('refuses unavailable/denied shapes without a demo or second transport fallback: %j', async (error) => {
  transport.mockResolvedValueOnce(response(error, 403));
  await expect(directory.listDirectorySchools({}, client)).rejects.toBeTruthy();
  expect(transport).toHaveBeenCalledTimes(1);
});
it('keeps network failures recoverable rather than presenting an empty catalog', async () => {
  transport.mockRejectedValue(new Error('Network unavailable'));
  await expect(directory.listDirectorySchools({}, client)).rejects.toBeTruthy();
}, 15000);
it.each([{ limit: 41 }, { limit: 0 }, { offset: -1 }, { offset: 0.5 }, { search: 'x'.repeat(101) }])('refuses invalid/unbounded page arguments before HTTP: %j', async (options) => {
  await expect(directory.listDirectorySchools(options, client)).rejects.toBeTruthy();
  expect(transport).not.toHaveBeenCalled();
});
it('refuses unconfigured browsing rather than showing fixtures', async () => {
  mockConfigured = false;
  await expect(directory.listDirectorySchools({}, client)).rejects.toThrow(/unavailable/i);
  expect(transport).not.toHaveBeenCalled();
});
it('reads one exact current school without leaking secret columns', async () => {
  transport.mockResolvedValueOnce(response({ ...school, team_code: 'secret' }));
  expect(await directory.getDirectorySchool(SCHOOL, client)).toEqual(school);
  expect(url().searchParams.get('id')).toBe('eq.' + SCHOOL);
});
it('returns null for a missing exact school and refuses invalid IDs before HTTP', async () => {
  transport.mockResolvedValueOnce(response(null));
  expect(await directory.getDirectorySchool(SCHOOL, client)).toBeNull();
  transport.mockClear();
  await expect(directory.getDirectorySchool('typed-name', client)).rejects.toBeTruthy();
  expect(transport).not.toHaveBeenCalled();
});
it('validates the current catalog before reading exact school/team roster labels', async () => {
  transport.mockResolvedValueOnce(response(school)).mockResolvedValueOnce(response([{ ...player, guardian_id: 'private', parental_consent_approved: true }]));
  expect(await directory.listDirectoryRoster({ schoolId: SCHOOL, schoolName: school.name, team: player.team, search: 'J', limit: 40 }, client)).toEqual({ items: [{ id: PLAYER, name: 'Jordan', jerseyNumber: 7, position: 'Wing', schoolName: 'School A', team: 'Girls Rugby' }], hasMore: false, nextOffset: null });
  expect(url(1).pathname).toBe('/rest/v1/players');
  expect(url(1).searchParams.get('select')).toBe('id,name,jersey_number,position,school_name,team');
  expect(url(1).searchParams.get('school_name')).toBe('eq.School A');
  expect(url(1).searchParams.get('team')).toBe('eq.Girls Rugby');
  expect(url(1).searchParams.get('limit')).toBe('41');
  expect(transport.mock.calls.every(([, init]) => new Headers(init?.headers).get('Authorization') === 'Bearer test-public-token')).toBe(true);
});
it('does not turn a renamed or missing school into a successful empty roster', async () => {
  transport.mockResolvedValueOnce(response({ ...school, name: 'Renamed School' }));
  await expect(directory.listDirectoryRoster({ schoolId: SCHOOL, schoolName: school.name }, client)).rejects.toThrow(/changed/i);
  expect(transport).toHaveBeenCalledTimes(1);
});
it('rejects malformed roster rows and cross-school response contamination', async () => {
  transport.mockResolvedValueOnce(response(school)).mockResolvedValueOnce(response([{ ...player, school_name: 'School B' }]));
  await expect(directory.listDirectoryRoster({ schoolId: SCHOOL, schoolName: school.name }, client)).rejects.toThrow(/unavailable/i);
});
it('keeps missing team labels as missing, never invented teams or accounts', async () => {
  transport.mockResolvedValueOnce(response(school)).mockResolvedValueOnce(response([{ ...player, team: null }]));
  const page = await directory.listDirectoryRoster({ schoolId: SCHOOL, schoolName: school.name, team: null }, client);
  expect(page.items).toEqual([{ id: PLAYER, name: 'Jordan', jerseyNumber: 7, position: 'Wing', schoolName: 'School A', team: null }]);
  expect(url(1).searchParams.get('team')).toBe('is.null');
});
it('preserves an existing school with unknown nullable metadata instead of hiding its identity', async () => {
  const actual = { ...school, city: null, mascot: null, division: null, region: null, level: null };
  transport.mockResolvedValueOnce(response([actual]));
  expect(await directory.listDirectorySchools({}, client)).toEqual({ items: [actual], hasMore: false, nextOffset: null });
});
it('preserves unknown jersey/position on an existing roster identity without inventing values', async () => {
  transport.mockResolvedValueOnce(response(school)).mockResolvedValueOnce(response([{ ...player, jersey_number: null, position: null }]));
  expect((await directory.listDirectoryRoster({ schoolId: SCHOOL, schoolName: school.name }, client)).items).toEqual([{ id: PLAYER, name: player.name, jerseyNumber: null, position: null, schoolName: school.name, team: player.team }]);
});

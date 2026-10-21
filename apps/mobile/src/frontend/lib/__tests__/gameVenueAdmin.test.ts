/** LOCAL-02: exercise real game writes at the network boundary so location input cannot vanish on save or schema failure. */
const mockInsert = jest.fn();
const mockUpdate = jest.fn();
const mockEq = jest.fn();
const mockSingle = jest.fn();
const mockFrom = jest.fn((..._args: unknown[]) => ({ insert: mockInsert, update: mockUpdate }));
jest.mock('@/lib/supabase', () => ({ isSupabaseConfigured: true, supabase: { from: (...args: unknown[]) => mockFrom(...args) } }));
jest.mock('@/lib/admin', () => ({ fetchAdminSpotlightAwards: jest.fn() }));

import { upsertGame } from '@/lib/adminCatalog';

beforeEach(() => {
  jest.clearAllMocks();
  mockSingle.mockResolvedValue({ data: { id: 'g1' }, error: null });
  const returning = { select: () => ({ single: mockSingle }) };
  mockInsert.mockReturnValue(returning);
  mockEq.mockReturnValue(returning);
  mockUpdate.mockReturnValue({ eq: mockEq });
});

const teams = { home_team: 'Home', away_team: 'Away' };

it('saves the chosen neutral venue independently of either school', async () => {
  await upsertGame({ ...teams, venue: ' Tournament gym ', venue_school: ' Host School ', venue_address: ' 12 Main St, Honolulu, HI ', venue_notes: ' Enter on the east side. ' });
  expect(mockInsert).toHaveBeenCalledWith(expect.objectContaining({ venue: 'Tournament gym', venue_school: 'Host School', venue_address: '12 Main St, Honolulu, HI', venue_notes: 'Enter on the east side.' }));
});

it('clears requested location fields while preserving omitted fields for ordinary game updates', async () => {
  await upsertGame({ ...teams, id: 'g1', venue_address: '' });
  expect(mockUpdate.mock.calls[0][0]).toHaveProperty('venue_address', '');
  expect(mockUpdate.mock.calls[0][0]).not.toHaveProperty('venue_school');
  expect(mockUpdate.mock.calls[0][0]).not.toHaveProperty('venue_notes');
  expect(mockUpdate.mock.calls[0][0]).not.toHaveProperty('venue');
  await upsertGame({ ...teams });
  expect(mockInsert.mock.calls[0][0]).not.toHaveProperty('venue_address');
});

it('preserves unchanged historical name whitespace when clearing an existing address', async () => {
  const legacyVenue = `  ${'L'.repeat(161)}  `;
  await upsertGame({ ...teams, id: 'g1', venue: legacyVenue, venue_address: '' });
  expect(mockUpdate.mock.calls[0][0]).toHaveProperty('venue', legacyVenue);
});

it.each([
  ['venue', 161], ['venue_school', 161], ['venue_address', 321], ['venue_notes', 401],
] as const)('rejects oversized %s before writing', async (field, length) => {
  await expect(upsertGame({ ...teams, [field]: 'a'.repeat(length) })).rejects.toThrow(/too long/i);
  expect(mockFrom).not.toHaveBeenCalled();
});

it('keeps a requested address unsaved and explains an unapplied migration without a lossy retry', async () => {
  mockSingle.mockResolvedValue({ error: { code: 'PGRST204', message: "Could not find the 'venue_address' column of 'games' in the schema cache" } });
  await expect(upsertGame({ ...teams, venue_address: '12 Main St' })).rejects.toThrow(/venue details.*not switched on/i);
  expect(mockInsert).toHaveBeenCalledTimes(1);
});

it('preserves permission failures as failures', async () => {
  mockSingle.mockResolvedValue({ error: { code: '42501', message: 'permission denied' } });
  await expect(upsertGame({ ...teams, venue_address: '12 Main St' })).rejects.toThrow(/permission denied/i);
});

it('does not claim an existing game saved when RLS returns no row', async () => {
  mockSingle.mockResolvedValue({ data: null, error: null });
  await expect(upsertGame({ ...teams, id: 'g1', venue_address: '12 Main St' })).rejects.toThrow(/removed|access changed/i);
});

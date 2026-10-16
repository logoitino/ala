/**
 * MINOR-01 client: the age band rule matches SQL, parsers fail safe, events read as sentences, the under-13 pause is
 * time-only, and each call sends the argument names the SQL declares. Synthetic data.
 */
const mockRpc = jest.fn();
jest.mock('@/lib/supabase', () => ({ isSupabaseConfigured: true, supabase: { rpc: (...args: unknown[]) => mockRpc(...args) } }));
const mockStore = new Map<string, string>();
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(async (key: string) => mockStore.get(key) ?? null),
  setItem: jest.fn(async (key: string, value: string) => { mockStore.set(key, value); }),
}));

import { GUARDIAN_CONSENT_SHA256, GUARDIAN_CONSENT_VERSION } from '@/data/guardianConsent';
import {
  acceptGuardianInvite,
  ageBandFrom,
  birthInputError,
  decideApproval,
  describeEvent,
  fetchGuardianMinors,
  isAgeGatePaused,
  parseMinorStatus,
  pauseAgeGate,
  previewGuardianInvite,
  recordMyBirthMonth,
  saveMyPrivacyStatus,
  signGuardianConsent,
} from '@/lib/minors';

beforeEach(() => {
  mockRpc.mockReset().mockResolvedValue({ data: null, error: null });
  mockStore.clear();
});

describe('ageBandFrom (same rule as age_band_from in SQL)', () => {
  const oct = new Date(2026, 9, 15);
  it('counts the birthday as the end of the birth month, never early', () => {
    expect(ageBandFrom(2013, 10, oct)).toBe('under_13'); // turns 13 this month: not yet
    expect(ageBandFrom(2013, 9, oct)).toBe('teen_13_15');
    expect(ageBandFrom(2010, 9, oct)).toBe('teen_16_17');
    expect(ageBandFrom(2010, 10, oct)).toBe('teen_13_15');
    expect(ageBandFrom(2008, 9, oct)).toBe('adult');
    expect(ageBandFrom(2008, 10, oct)).toBe('teen_16_17');
    expect(ageBandFrom(null, 3, oct)).toBe('unknown');
  });

  it('explains what is missing or impossible', () => {
    expect(birthInputError(2001, null, oct)).toBe('Choose your birth month.');
    expect(birthInputError(null, 3, oct)).toBe('Enter the year you were born.');
    expect(birthInputError(2026, 11, oct)).toBe('Check your birth month and year.');
    expect(birthInputError(2001, 3, oct)).toBeNull();
  });
});

it('the under-13 pause stores only a time and lasts 24 hours', async () => {
  await pauseAgeGate(1_000);
  expect([...mockStore.values()]).toEqual(['1000']);
  await expect(isAgeGatePaused(1_000 + 60_000)).resolves.toBe(true);
  await expect(isAgeGatePaused(1_000 + 25 * 3600 * 1000)).resolves.toBe(false);
});

it('parses the minor status safely and drops malformed rows', () => {
  expect(parseMinorStatus(null)).toBeNull();
  const s = parseMinorStatus({
    age_band: 'teen_13_15', needs_birth: false, has_public_consent: true,
    guardians: [{ link_id: 'l1', first_name: 'Mele', consent: { signed_at: 'x', allows_public_profile: true } }, { first_name: 'no id' }],
    pending_approvals: [{ id: 'r1', change_key: 'account_public' }, { id: 'r2', change_key: 'something_else' }],
  });
  expect(s?.ageBand).toBe('teen_13_15');
  expect(s?.guardians).toHaveLength(1);
  expect(s?.guardians[0].consent?.allowsPublicProfile).toBe(true);
  expect(s?.pendingApprovals.map((r) => r.id)).toEqual(['r1']);
  expect(parseMinorStatus({ age_band: 'weird' })?.ageBand).toBe('unknown');
});

it('reads events as plain sentences', () => {
  expect(describeEvent({ kind: 'consent_signed', detail: { public_profile: true, donations: false }, at: '', byTeen: false })).toBe('Consent signed for a public profile.');
  expect(describeEvent({ kind: 'approval_decided', detail: { change: 'friend_requests_everyone', approved: false }, at: '', byTeen: false })).toBe('Accept friend requests from anyone: declined.');
  expect(describeEvent({ kind: 'settings_changed', detail: { keys: ['hide_from_search'] }, at: '', byTeen: true })).toBe('Changed: search.');
});

it('calls each function with its exact argument names and sends the pinned form version and hash', async () => {
  mockRpc.mockResolvedValueOnce({ data: { status: 'blocked' }, error: null });
  await expect(recordMyBirthMonth(2016, 2)).resolves.toBe('blocked');
  expect(mockRpc).toHaveBeenLastCalledWith('set_my_birth_month', { birth_y: 2016, birth_m: 2 });

  mockRpc.mockResolvedValueOnce({ data: { status: 'bad_code' }, error: null });
  await expect(previewGuardianInvite(' k7m2q9xa ')).resolves.toEqual({ status: 'bad_code' });
  expect(mockRpc).toHaveBeenLastCalledWith('preview_guardian_invite', { invite_code: 'K7M2Q9XA' });

  const consent = { signerName: ' Mele Fua ', relationship: 'parent' as const, allowsDonations: false, allowsPublicProfile: true };
  mockRpc.mockResolvedValueOnce({ data: { status: 'waiting_for_teen', first_name: 'Lani' }, error: null });
  await expect(acceptGuardianInvite('k7m2q9xa', consent)).resolves.toEqual({ status: 'waiting_for_teen', firstName: 'Lani' });
  expect(mockRpc).toHaveBeenLastCalledWith('accept_guardian_invite', {
    invite_code: 'K7M2Q9XA', signer_name: 'Mele Fua', relationship: 'parent', allows_donations: false, allows_public_profile: true,
    form_version: GUARDIAN_CONSENT_VERSION, form_sha256: GUARDIAN_CONSENT_SHA256,
  });

  await signGuardianConsent('m1', consent);
  expect(mockRpc).toHaveBeenLastCalledWith('sign_guardian_consent', expect.objectContaining({ minor_profile_id: 'm1', form_sha256: GUARDIAN_CONSENT_SHA256 }));
  await decideApproval('r1', true);
  expect(mockRpc).toHaveBeenLastCalledWith('guardian_decide_approval', { request_id: 'r1', approve: true });

  mockRpc.mockResolvedValueOnce({ data: { account_private: true, held_for_approval: ['account_public', 'bogus'], minor: { age_band: 'teen_13_15' } }, error: null });
  const saved = await saveMyPrivacyStatus({ accountPrivate: false });
  expect(mockRpc).toHaveBeenLastCalledWith('set_my_privacy', { settings: { account_private: false } });
  expect(saved.heldForApproval).toEqual(['account_public']);
  expect(saved.settings.accountPrivate).toBe(true);
});

it('maps guardian rows, keeping waiting and not-linked teens', async () => {
  mockRpc.mockResolvedValueOnce({ data: [
    { profile_id: 'm1', first_name: 'Lani', age_band: 'teen_13_15', link_id: 'l1', link_status: 'linked', account_private: true, pending_approvals: 2 },
    { profile_id: 'm2', first_name: 'Sefa', age_band: 'teen_16_17', link_id: null, link_status: 'not_linked', can_allow_donations: true },
    { first_name: 'no id' },
  ], error: null });
  const rows = await fetchGuardianMinors();
  expect(rows.map((r) => [r.profileId, r.linkStatus, r.pendingApprovals, r.canAllowDonations])).toEqual([['m1', 'linked', 2, false], ['m2', 'not_linked', 0, true]]);
});

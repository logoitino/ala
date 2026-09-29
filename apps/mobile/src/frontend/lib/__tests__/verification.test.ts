const mockRpc = jest.fn();

jest.mock('@/lib/supabase', () => ({
  isSupabaseConfigured: true,
  supabase: { rpc: (...args: unknown[]) => mockRpc(...args) },
}));

import {
  claimAthlete,
  fetchMyVerification,
  fetchPlayerVerified,
  parseMyVerification,
  redeemTeamCode,
  requestAthleteVerification,
  startSchoolCheck,
} from '@/lib/verification';
import { confirmAthlete, parseConfirmationQueue } from '@/lib/schoolConfirm';

const MISSING = { message: 'Could not find the function public.claim_athlete in the schema cache' };

beforeEach(() => {
  mockRpc.mockReset();
});

describe('verification ladder client', () => {
  it('a school code leaves the account pending, not verified', async () => {
    mockRpc.mockResolvedValue({ data: { ok: true, verification_status: 'pending', school_name: 'Westlake' }, error: null });
    const result = await redeemTeamCode('wstlk-rug-2026');
    expect(mockRpc).toHaveBeenCalledWith('redeem_team_code', { raw_code: 'WSTLK-RUG-2026' });
    expect(result.verification_status).toBe('pending');
    expect(result.school_name).toBe('Westlake');
  });

  it('request approval no longer falls back to direct table writes', async () => {
    mockRpc.mockResolvedValue({ data: null, error: MISSING });
    await expect(requestAthleteVerification()).rejects.toThrow(/schema cache/);
  });

  it('claimAthlete sends the roster pick and tolerates a missing RPC', async () => {
    mockRpc.mockResolvedValueOnce({ data: { ok: true }, error: null });
    await expect(claimAthlete('p1')).resolves.toBe(true);
    expect(mockRpc).toHaveBeenCalledWith('claim_athlete', { target_player_id: 'p1', request_notes: null });
    mockRpc.mockResolvedValueOnce({ data: null, error: MISSING });
    await expect(claimAthlete(null)).resolves.toBe(false);
  });

  it('parses get_my_verification', async () => {
    const raw = {
      verification_status: 'pending',
      request_status: 'pending',
      school_name: 'Westlake',
      has_school: true,
      sport: 'Rugby',
      code_expires_at: null,
      confirmer_name: null,
      decision_note: null,
    };
    expect(parseMyVerification(raw)).toMatchObject({ status: 'pending', hasSchool: true, schoolName: 'Westlake' });
    expect(parseMyVerification(null)).toBeNull();
    mockRpc.mockResolvedValue({ data: null, error: MISSING });
    await expect(fetchMyVerification()).resolves.toBeNull();
  });

  it('startSchoolCheck returns the code or the server reason', async () => {
    mockRpc.mockResolvedValueOnce({ data: { ok: true, code: '042917', expires_at: '2026-09-29T20:00:00Z' }, error: null });
    await expect(startSchoolCheck()).resolves.toEqual({ code: '042917', expiresAt: '2026-09-29T20:00:00Z' });
    mockRpc.mockResolvedValueOnce({ data: { ok: false, error: 'Add your school first.' }, error: null });
    await expect(startSchoolCheck()).rejects.toThrow('Add your school first.');
  });

  it('treats an unknown verification check as held', async () => {
    mockRpc.mockResolvedValueOnce({ data: true, error: null });
    await expect(fetchPlayerVerified('p1')).resolves.toBe(true);
    mockRpc.mockResolvedValueOnce({ data: null, error: { message: 'boom' } });
    await expect(fetchPlayerVerified('p1')).resolves.toBe(false);
    await expect(fetchPlayerVerified(null)).resolves.toBe(false);
  });
});

describe('school confirmation client', () => {
  it('parses the queue and drops rows without an id', () => {
    const queue = parseConfirmationQueue({
      ok: true,
      confirmer_name: 'Coach Tui',
      staff_role: 'coach',
      sport: 'Rugby',
      school_name: 'Westlake',
      requests: [{ id: 'q1', full_name: 'Malia', class_year: '2027', jersey: '9', code_ready: true }, { full_name: 'x' }],
    });
    expect(queue.staffRole).toBe('coach');
    expect(queue.requests).toHaveLength(1);
    expect(queue.requests[0]).toMatchObject({ fullName: 'Malia', classYear: '2027', codeReady: true });
  });

  it('throws the server message for a dead link', () => {
    expect(() => parseConfirmationQueue({ ok: false, error: 'This link is not active.' })).toThrow('This link is not active.');
  });

  it('sends the code only when confirming, and returns wrong-code errors', async () => {
    mockRpc.mockResolvedValueOnce({ data: { ok: false, error: 'That code does not match.' }, error: null });
    const bad = await confirmAthlete({ token: ' tok ', requestId: 'q1', approve: true, meetCode: '12 34 56', signature: 'Ana Tui' });
    expect(bad).toEqual({ ok: false, error: 'That code does not match.' });
    expect(mockRpc).toHaveBeenLastCalledWith('school_confirm_athlete', {
      confirm_token: 'tok',
      request_id: 'q1',
      approve: true,
      meet_code: '123456',
      confirmer_signature: 'Ana Tui',
      note: null,
    });

    mockRpc.mockResolvedValueOnce({ data: { ok: true, status: 'rejected' }, error: null });
    const declined = await confirmAthlete({ token: 'tok', requestId: 'q1', approve: false, meetCode: '999999', signature: 'Ana Tui' });
    expect(declined).toEqual({ ok: true, status: 'rejected' });
    expect(mockRpc.mock.calls[1][1]).toMatchObject({ approve: false, meet_code: null });
  });
});

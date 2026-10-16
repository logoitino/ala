/** QUIZ-05 adapter: shown-position results, fun-fact / report / import wrappers, the paste parser and fail-closed reads.
 * Synthetic fixtures; no database. */
import * as fresh from '@/lib/freshQuestions';
import { displayResult, fetchTimedSportQuizAdmin, answerTimedSportQuiz } from '@/lib/sportQuiz';

const mockClient = {
  response: {} as unknown, error: null as null | { code: string; message: string }, calls: [] as { fn: string; args: Record<string, unknown> }[],
  rpc(this: { response: unknown; error: unknown; calls: { fn: string; args: Record<string, unknown> }[] }, fn: string, args: Record<string, unknown>) {
    this.calls.push({ fn, args }); return Promise.resolve({ data: this.response, error: this.error });
  },
};
jest.mock('@/lib/supabase', () => ({ get supabase() { return mockClient; }, isSupabaseConfigured: true }));
beforeEach(() => { mockClient.calls = []; mockClient.error = null; });
const P = '00000000-0000-0000-0000-000000000001';
const fact = { id: 'f1', prompt_key: 'hype_song', label: 'Hype song', answer_text: 'Island Jam', status: 'admin_review', submitted_at: '2026-10-15T00:00:00Z',
  guardian_decision: null, guardian_decided_at: null, admin_decided_at: null, decline_reason: null, cleared_at: null };

describe('answer shuffle in the client adapter', () => {
  it('reads results in shown positions and keeps the stored indices', () => {
    const r = displayResult({ answered_option: 3, correct_option: 0, answered_position: 1, correct_position: 2, shown_order: [2, 3, 0, 1], was_correct: false });
    expect(r).toMatchObject({ answered_option: 1, correct_option: 2, stored_answered_option: 3, stored_correct_option: 0 });
    expect(displayResult({ answered_option: 1, correct_option: 1 })).toEqual({ answered_option: 1, correct_option: 1 });
    expect(displayResult({ answered_option: null, correct_option: 0, answered_position: null, correct_position: 3 })).toMatchObject({ answered_option: null, correct_option: 3 });
  });
  it('maps an answer receipt so existing screens highlight the option they showed', async () => {
    mockClient.response = { contract_version: 2, profile_id: P, request_id: 'r1', operation: 'answer', outcome: 'answered', week_start: '2026-10-12', committed_at: '2026-10-15T00:00:00Z',
      round_kind: 'personal', preferences: null,
      attempt: { id: 'a1', week_start: '2026-10-12', mode: 'round', status: 'issued', started_at: '2026-10-15T00:00:00Z', expires_at: '2026-10-15T00:01:30Z', duration_seconds: 90,
        closed_at: null, close_reason: null, effective_expired: false, correction_reason: null, round_state: 'between', position: 1, planned_items: 5, round_size: 5,
        next_by: '2026-10-15T00:03:30Z', answered_count: 1, short_round: false, group_id: null, round_kind: 'personal' },
      result: { answered_option: 2, correct_option: 2, was_correct: true, explanation: 'Shared by Lani as a fun fact.', completed_at: '2026-10-15T00:00:10Z', position: 1,
        item_status: 'answered', answered_position: 0, correct_position: 0, shown_order: [2, 0, 1, 3], fun_fact: { first_name: 'Lani', athlete_player_id: 'pl1' } } };
    const r = await answerTimedSportQuiz({ attempt_id: 'a1', option: 0, request_id: 'r1', session_secret: 'ab'.repeat(32), expected_profile_id: P });
    expect(r.result).toMatchObject({ answered_option: 0, correct_option: 0, stored_correct_option: 2, fun_fact: { first_name: 'Lani', athlete_player_id: 'pl1' } });
    expect(mockClient.calls[0].args.p_option).toBe(0);
  });
});

describe('admin snapshot QUIZ-05 blocks', () => {
  const snap = { contract_version: 2, generated_at: '2026-10-15T00:00:00Z', week_start: '2026-10-12', week_end: '2026-10-19', settings: null, questions: [], question_total: 0,
    question_cap: 300, next_question_cursor: null, next_before: null, pools: [],
    audit: [{ id: '5', action: 'question_pause', actor_id: null, question_id: 'q1', reason: 'reports', created_at: '2026-10-15T00:00:00Z' },
      { id: '4', action: 'report_alert', actor_id: null, question_id: null, reason: 'science', created_at: '2026-10-15T00:00:00Z' }],
    counts: { questions_draft: 0, questions_approved: 0, questions_archived: 0, questions_void: 0, week_issued: 0, week_completed: 0, week_skipped: 0, week_void: 0, week_ended: 0,
      week_expired: 0, badges_issued: 0, badges_void: 0, preferences_weekly: 0, exposures: 0, week_spent: 0, retained_guards: 0, retained_requests: 0 },
    refill: [{ scope: 'topic', key: 'geography', approved: 0, pace_per_player_week: 0, pace_source: 'assumed', max_seen: 0, weeks_left: 0, refill_needed: true }],
    fresh: { athlete_questions_enabled: false, athlete_share_pct: 0, reports_paused: false, needs_look_count: 2, paused_count: 1, facts_admin_review: 1, facts_guardian_review: 0,
      facts_live: 0, alerts: ['science'], self_heal: fresh.FRESH_SELF_HEAL_DEFAULTS, report_rules: { ordinary_reporters: 2, fact_reporters: 1, fact_reasons: ['not_okay', 'private'],
        restored_reporters: 3, daily_pause_cap: 10, min_account_days: 7, per_account_per_day: 10, reporter_clear_days: 90, delete_days: 180 } } };
  it('reads refill and fresh, and accepts the new audit actions', async () => {
    mockClient.response = snap;
    const s = await fetchTimedSportQuizAdmin();
    expect(s.refill?.[0]).toMatchObject({ key: 'geography', refill_needed: true });
    expect(s.fresh?.needs_look_count).toBe(2); expect(s.audit.map(a => a.action)).toEqual(['question_pause', 'report_alert']);
  });
  it('refuses a refill row whose Refill needed disagrees with weeks left', async () => {
    mockClient.response = { ...snap, refill: [{ ...snap.refill[0], weeks_left: 9 }] };
    await expect(fetchTimedSportQuizAdmin()).rejects.toThrow(/unavailable/);
  });
});

describe('fun facts, reports and admin wrappers', () => {
  it('submits and withdraws with the expected profile; reads the refusal codes', async () => {
    mockClient.response = { contract_version: 5, fact };
    expect((await fresh.submitFunFact('hype_song', 'Island Jam', P)).status).toBe('admin_review');
    expect(mockClient.calls[0]).toEqual({ fn: 'quiz_fact_submit', args: { p_prompt_key: 'hype_song', p_answer: 'Island Jam', p_expected_profile_id: P } });
    mockClient.response = { contract_version: 5, fact: { ...fact, status: 'withdrawn', answer_text: null } };
    expect((await fresh.withdrawFunFact('f1', P)).answer_text).toBeNull();
    expect(fresh.funFactTextCodes('quiz_fact_text: digits, school_or_city')).toEqual(['digits', 'school_or_city']);
    expect(fresh.FUN_FACT_TEXT_WORDS.digits).toMatch(/numbers/);
  });
  it('fails closed on a salt or an unknown status', async () => {
    mockClient.response = { contract_version: 5, fact: { ...fact, status: 'secret_state' } };
    await expect(fresh.submitFunFact('hype_song', 'Island Jam', P)).rejects.toThrow(/unavailable/);
    mockClient.response = { contract_version: 5, fact, fact_salt: 'x' };
    await expect(fresh.submitFunFact('hype_song', 'Island Jam', P)).rejects.toThrow(/unavailable/);
  });
  it('reports with a fixed reason and never learns whether it counted', async () => {
    mockClient.response = { contract_version: 5, outcome: 'reported', question_id: 'q1' };
    expect((await fresh.reportTriviaQuestion('q1', 'not_okay', P)).outcome).toBe('reported');
    await expect(fresh.reportTriviaQuestion('q1', 'rude' as never, P)).rejects.toThrow();
  });
  it('buckets counts and guardian decisions', async () => {
    mockClient.response = { contract_version: 5, profile_id: P, facts: [{ id: 'f1', prompt_key: 'hype_song', months: [{ month: '2026-09', bucket: '10+' }, { month: '2026-08', bucket: null }] }] };
    expect((await fresh.fetchFunFactCounts()).facts[0].months[1].bucket).toBeNull();
    mockClient.response = { contract_version: 5, profile_id: P, facts: [{ id: 'f1', prompt_key: 'hype_song', months: [{ month: '2026-09', bucket: '3' }] }] };
    await expect(fresh.fetchFunFactCounts()).rejects.toThrow(/unavailable/);
    mockClient.response = { contract_version: 5, fact_id: 'f1', status: 'admin_review' };
    expect((await fresh.decideGuardianFunFact('f1', true, P)).status).toBe('admin_review');
  });
  it('decides facts, saves bounded settings and refuses an oversized import before calling', async () => {
    mockClient.response = { contract_version: 5, fact_id: 'f1', status: 'approved', question_id: 'q9' };
    await fresh.decideFact('f1', { action: 'approve', reason: 'Checked by the admin.', checklist: { no_sponsor_or_business: true, no_place: true, no_schedule: true } }, P);
    expect(mockClient.calls[0].args).toMatchObject({ p_action: 'approve', p_payload: { reason: 'Checked by the admin.', checklist: { no_place: true } } });
    await expect(fresh.saveFreshSettings({ athlete_questions_enabled: true, athlete_share_pct: 11, reports_paused: false, self_heal: fresh.FRESH_SELF_HEAL_DEFAULTS }, 'A reason here', P)).rejects.toThrow(/range/);
    expect(fresh.selfHealValid({ ...fresh.FRESH_SELF_HEAL_DEFAULTS, min_responders: 10 })).toBe(false);
    const calls = mockClient.calls.length;
    await expect(fresh.importTriviaQuestions(Array.from({ length: 201 }, () => ({}) as never), true, 'A reason here', P)).rejects.toThrow(/200 rows/);
    expect(mockClient.calls.length).toBe(calls);
  });
});

describe('paste parser', () => {
  it('reads tab and comma rows, skips a header, keeps formula cells for the server to refuse', () => {
    const { rows, errors } = fresh.parseImportPaste([
      'topic\tsport\ttype\tquestion\ta1\ta2\ta3\ta4\tcorrect\texplanation\tsource',
      'sport\tBasketball\tchoice4\tHow many players are on the court for one team?\t3\t4\t5\t6\t3\tFive players per team.\tRule book',
      'life,Money Huddle,true_false,"A budget is a plan, right?",,,,,True,True. A budget is a plan.,Everyday fact',
      'science\t\tchoice4\t=HYPERLINK("x")\tA\tB\tC\tD\tB\tExplanation text.\t',
      'too\tshort',
    ].join('\n'));
    expect(rows).toHaveLength(3);
    expect(rows[0]).toMatchObject({ topic_category: 'sport', sport: 'Basketball', correct_option: 2, options: ['3', '4', '5', '6'] });
    expect(rows[1]).toMatchObject({ topic_category: 'life', chapter: 'money_huddle', question_type: 'true_false', options: ['True', 'False'], correct_option: 0, prompt: 'A budget is a plan, right?' });
    expect(rows[2].prompt.startsWith('=')).toBe(true); expect(rows[2].source_notes).toMatch(/verify/);
    expect(errors).toEqual([{ line: 5, message: expect.stringMatching(/10 or 11 columns/) }]);
  });
});

describe('security review: unavailable fun facts in history', () => {
  it('accepts item_status fact_unavailable without positions and leaves the indices as sent', () => {
    const r = displayResult({ answered_option: null, correct_option: 2, item_status: 'fact_unavailable', correct_position: null, answered_position: null, shown_order: null });
    expect(r).toMatchObject({ item_status: 'fact_unavailable', correct_option: 2, answered_option: null });
    expect('stored_correct_option' in (r as object)).toBe(false);
  });
});

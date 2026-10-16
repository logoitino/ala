/** QUIZ-04 Life Playbook adapter: Start, private opt-in, chapters / progress / level parsers and the admin Life desk reads. Synthetic fixtures. */
import * as life from '@/lib/lifePlaybook';

const mockClient = {
  response: {} as unknown,
  calls: [] as { fn: string; args: Record<string, unknown> }[],
  rpc(this: { response: unknown; calls: { fn: string; args: Record<string, unknown> }[] }, fn: string, args: Record<string, unknown>) {
    this.calls.push({ fn, args }); return Promise.resolve({ data: this.response, error: null });
  },
};
jest.mock('@/lib/supabase', () => ({ get supabase() { return mockClient; }, isSupabaseConfigured: true }));
beforeEach(() => { mockClient.calls = []; mockClient.response = null; });

const profile = '00000000-0000-0000-0000-000000000001';
const request = '00000000-0000-0000-0000-000000000002';
const now = '2026-10-14T17:00:00.000Z';
const later = '2026-10-14T17:01:30.000Z';
const th = { rookie: 0, varsity: 15, all_star: 40, pro: 80, hall_of_fame: 150 };
const prefs = { life_opt_in: true, life_notice_version: 'life-playbook-v1-testing', life_opted_in_at: now, life_version: 1 };
const snapshot = { contract_version: 4, profile_id: profile, server_now: now, week_start: '2026-10-12', week_end: '2026-10-19', testing_only: true, availability: 'ready',
  notice_version: 'life-playbook-v1-testing', preferences: prefs, week_spent: false, attempt: null, active_round_kind: null, default_duration_seconds: 90, round_size: 5,
  chapters_open: 1, unseen_count: 20 };
const round = { id: 'attempt', week_start: '2026-10-12', mode: 'round', status: 'issued', started_at: now, expires_at: later, duration_seconds: 90, closed_at: null, close_reason: null,
  effective_expired: false, correction_reason: null, round_state: 'item', position: 1, planned_items: 5, round_size: 5, next_by: null, answered_count: 0, short_round: false, group_id: null, round_kind: 'life' };
const question = { id: 'q1', question_key: 'k1', version: 1, topic_category: 'life', sport: 'Money Huddle', prompt: 'A budget is a game plan for which thing?', options: ['Money', 'Time', 'Food', 'Rest'], question_type: 'choice4' };
const started = { contract_version: 2, profile_id: profile, request_id: request, operation: 'start', outcome: 'started', week_start: '2026-10-12', committed_at: now, round_kind: 'life',
  attempt: round, result: null, preferences: null, server_now: now, active_question: question, active_item: { position: 1, planned_items: 5, expires_at: later } };

describe('QUIZ-04 Life participant adapter', () => {
  it('reads the snapshot strictly and refuses unknown availability or a secret-bearing payload', async () => {
    mockClient.response = snapshot; expect((await life.fetchLifeSnapshot()).availability).toBe('ready');
    for (const patch of [{ availability: 'unlock' }, { contract_version: 3 }, { session_hash: 'x' }, { preferences: { ...prefs, life_version: -1 } }, { attempt: { ...round, prompt: 'x' } }]) {
      mockClient.response = { ...snapshot, ...patch }; await expect(life.fetchLifeSnapshot()).rejects.toThrow(/unavailable/i);
    }
  });
  it('starts a Life round with the Life notice and a 90-second default, and accepts only a life-kind open item', async () => {
    mockClient.response = started;
    const input = { expected_week: '2026-10-12', request_id: request, session_secret: 'a'.repeat(64), expected_profile_id: profile, notice_version: life.LIFE_NOTICE_VERSION,
      chapter: null, duration_seconds: life.LIFE_DEFAULT_DURATION };
    await expect(life.startLifeRound(input)).resolves.toMatchObject({ outcome: 'started' });
    expect(mockClient.calls[0]).toEqual({ fn: 'quiz_life_start', args: { p_expected_week: '2026-10-12', p_request_id: request, p_session_secret: 'a'.repeat(64),
      p_expected_profile_id: profile, p_notice_version: 'life-playbook-v1-testing', p_chapter: null, p_duration_seconds: 90 } });
    mockClient.response = { ...started, attempt: { ...round, round_kind: 'personal' } }; await expect(life.startLifeRound(input)).rejects.toThrow(/unavailable/i);
    mockClient.response = { ...started, active_question: { ...question, correct_option: 0 } }; await expect(life.startLifeRound(input)).rejects.toThrow(/unavailable/i);
  });
  it('saves the private opt-in with CAS and the notice only when opting in', async () => {
    mockClient.response = { contract_version: 4, profile_id: profile, outcome: 'saved', preferences: { ...prefs, life_opt_in: false, life_opted_in_at: null } };
    await life.saveLifePreferences(false, 1, profile);
    expect(mockClient.calls[0].args).toEqual({ p_opt_in: false, p_notice_version: null, p_expected_version: 1, p_expected_profile_id: profile });
    await expect(life.saveLifePreferences(true, 1, profile)).rejects.toThrow(/unavailable/i);
  });
  it('parses chapters, progress and the level; progress is a share between 0 and 1', async () => {
    mockClient.response = { contract_version: 4, profile_id: profile, chapters: [{ id: 'money_huddle', title: 'Money Huddle', framing: 'Calling the play', position: 1, open: true, unseen_count: 3, note: 'admin only' }] };
    expect((await life.fetchLifeChapters()).chapters[0]).toEqual({ id: 'money_huddle', title: 'Money Huddle', framing: 'Calling the play', position: 1, open: true, unseen_count: 3 });
    mockClient.response = { contract_version: 4, profile_id: profile, chapters: [{ id: 'unlock_me', title: 'X', framing: '', position: 9, open: true, unseen_count: 1 }] };
    await expect(life.fetchLifeChapters()).rejects.toThrow(/unavailable/i);
    const chapter = { id: 'money_huddle', title: 'Money Huddle', approved_count: 20, seen_count: 5, progress: 0.25, facts: 4, rank: 0, level: 'rookie', level_label: 'Rookie', badge_earned: false };
    mockClient.response = { contract_version: 4, profile_id: profile, thresholds: th, chapters: [chapter] };
    expect((await life.fetchLifeProgress()).chapters[0].progress).toBe(0.25);
    mockClient.response = { contract_version: 4, profile_id: profile, thresholds: th, chapters: [{ ...chapter, progress: 1.5 }] };
    await expect(life.fetchLifeProgress()).rejects.toThrow(/unavailable/i);
    mockClient.response = { contract_version: 4, profile_id: profile, facts: 16, rank: 1, level: 'varsity', level_label: 'Varsity', next_level: 'all_star', next_at: 40, thresholds: th, reached_at: now };
    expect((await life.fetchTriviaLevel()).level).toBe('varsity');
  });
  it('validates thresholds like the server and reads copy-rule refusals', () => {
    expect(life.lifeThresholdsValid(th)).toBe(true);
    expect(life.lifeThresholdsValid({ ...th, rookie: 1 })).toBe(false);
    expect(life.lifeThresholdsValid({ ...th, pro: 30 })).toBe(false);
    expect(life.lifeThresholdsValid({ rookie: 0, varsity: 1 })).toBe(false);
    expect(life.lifeCopyRules('quiz_life_copy: advice_you_should, brand_name')).toEqual(['advice_you_should', 'brand_name']);
    expect(life.lifeCopyRules('quiz_life_copy: nil_eligibility, tax_loan_credit, money_figure, year, scam_missing_report_line, prompt_too_long, explanation_too_long'))
      .toEqual(['nil_eligibility', 'tax_loan_credit', 'money_figure', 'year', 'scam_missing_report_line', 'prompt_too_long', 'explanation_too_long']);
    // Rules removed by the 2026-10-15 owner simplification are not recognized any more.
    expect(life.lifeCopyRules('quiz_life_copy: health_topic, missing_disclaimer, unmarked_figure')).toEqual([]);
    expect(life.lifeCopyRules('quiz_life_attestation_required')).toEqual([]);
  });
});

const chapterState = { approved_count: 2, needs_more: 3, ready: false, switched_open: false, open: false, reasons: ['needs 3 more approved questions'] };
const adminSnap = { contract_version: 4, generated_at: now, settings: { life_enabled: false, level_thresholds: th, round_size: 5, enabled: true },
  life_cap: 200, life_active_total: 40, open_at: 5,
  chapters: [{ id: 'savings_season', title: 'Savings Season', framing: 'Building your bench', position: 2, updated_at: now, draft_count: 10, ...chapterState }],
  stats: { opted_in: null, week_life_rounds: null, questions: [], questions_hidden: 2,
    cells: [{ age_band: 'adult', chapter: 'savings_season', players: null, hidden: true }], levels: [{ level: 'rookie', label: 'Rookie', players: 12, hidden: false }] } };
describe('QUIZ-04 Life admin adapter', () => {
  it('accepts an aggregate-only desk read and refuses small cells, thin question stats or an open chapter that is not ready', async () => {
    mockClient.response = adminSnap; expect((await life.fetchLifeAdmin()).chapters[0].reasons).toEqual(['needs 3 more approved questions']);
    for (const stats of [{ ...adminSnap.stats, cells: [{ age_band: 'adult', chapter: 'savings_season', players: 4, hidden: false }] },
      { ...adminSnap.stats, questions: [{ question_id: 'q', chapter: 'savings_season', responders: 5, correct_share: 1 }] },
      { ...adminSnap.stats, opted_in: 3 }]) {
      mockClient.response = { ...adminSnap, stats }; await expect(life.fetchLifeAdmin()).rejects.toThrow(/unavailable/i);
    }
    mockClient.response = { ...adminSnap, chapters: [{ ...adminSnap.chapters[0], open: true }] }; await expect(life.fetchLifeAdmin()).rejects.toThrow(/unavailable/i);
    mockClient.response = { ...adminSnap, open_at: 20 }; await expect(life.fetchLifeAdmin()).rejects.toThrow(/unavailable/i);
    mockClient.response = { ...adminSnap, chapters: [{ ...adminSnap.chapters[0], id: 'credit_clock' }] }; await expect(life.fetchLifeAdmin()).rejects.toThrow(/unavailable/i);
  });
  it('sends settings and chapter writes with the reason and expected actor; no sign-off or reviewer wrappers remain', async () => {
    mockClient.response = { contract_version: 4, life_enabled: true, level_thresholds: th };
    await life.saveLifeSettings({ life_enabled: true, level_thresholds: th }, 'Turn Life on for testers.', profile);
    expect(mockClient.calls[0]).toEqual({ fn: 'quiz_admin_life_settings', args: { p_payload: { life_enabled: true, level_thresholds: th }, p_reason: 'Turn Life on for testers.', p_expected_actor_id: profile } });
    mockClient.response = { contract_version: 4, chapter: 'savings_season', ...chapterState, switched_open: false };
    await life.setLifeChapterOpen('savings_season', false, 'Close for review.', profile);
    expect(mockClient.calls[1].args).toEqual({ p_chapter: 'savings_season', p_open: false, p_reason: 'Close for review.', p_expected_actor_id: profile });
    for (const name of ['recordLifeSignoff', 'confirmLifeSignoff', 'grantLifeReviewer', 'confirmLifeReviewer', 'revokeLifeReviewer']) expect(name in life).toBe(false);
    expect(life.LIFE_CHAPTER_IDS).toEqual(['money_huddle', 'savings_season', 'scam_defense', 'smart_plays']);
  });
});

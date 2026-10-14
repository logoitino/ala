/** QUIZ-01 adapter boundaries: real bound RPC calls, exact retry tokens and fail-closed data. Synthetic fixtures. */
import {
  answerSportQuiz, fetchSportQuiz, fetchSportQuizAdmin, saveSportQuizQuestion, saveSportQuizSettings,
  skipSportQuiz, startSportQuiz,
} from '@/lib/sportQuiz';

const mockClient = {
  response: {} as unknown,
  error: null as null | { code: string; message: string },
  calls: [] as { fn: string; args: Record<string, unknown> }[],
  rpc(this: { response: unknown; error: unknown; calls: { fn: string; args: Record<string, unknown> }[] }, fn: string, args: Record<string, unknown>) {
    this.calls.push({ fn, args }); return Promise.resolve({ data: this.response, error: this.error });
  },
};
jest.mock('@/lib/supabase', () => ({ get supabase() { return mockClient; }, isSupabaseConfigured: true }));
const own = {
  availability: 'ready', testing_only: true, week_start: '2026-10-12', week_end: '2026-10-19', status: 'available',
  sports: ['American football'], attempt: null, badges: [], corrections: [],
};
beforeEach(() => { mockClient.calls = []; mockClient.response = own; mockClient.error = null; });

it('uses the bound client for own snapshot/start/skip with actual named arguments', async () => {
  expect(await fetchSportQuiz()).toEqual(own);
  await startSportQuiz('American football'); await skipSportQuiz();
  expect(mockClient.calls).toEqual([
    { fn: 'quiz_snapshot', args: {} }, { fn: 'quiz_start', args: { p_sport: 'American football' } }, { fn: 'quiz_skip', args: {} },
  ]);
});
it('preserves the caller request id and option across exact retries', async () => {
  await answerSportQuiz('attempt-1', 0, 'request-1'); await answerSportQuiz('attempt-1', 0, 'request-1');
  expect(mockClient.calls).toEqual(Array(2).fill({ fn: 'quiz_answer', args: { p_attempt_id: 'attempt-1', p_option: 0, p_request_id: 'request-1' } }));
});
it('does not turn a missing backend into a question, badge or empty healthy report', async () => {
  mockClient.error = { code: 'PGRST202', message: 'Missing quiz_snapshot' };
  await expect(fetchSportQuiz()).rejects.toThrow(/not switched on/);
  mockClient.error = null; mockClient.response = null;
  await expect(fetchSportQuiz()).rejects.toThrow(/unavailable/i);
});
it('rejects response shape that claims a public completion badge or production mode', async () => {
  mockClient.response = { ...own, testing_only: false }; await expect(fetchSportQuiz()).rejects.toThrow(/unavailable/i);
  mockClient.response = { ...own, badges: [{ id: 'badge', visibility: 'public', label: 'Sport Learner' }] };
  await expect(fetchSportQuiz()).rejects.toThrow(/unavailable/i);
});
it('sends explicit tester settings and question rationale; preserves the bigint cursor string', async () => {
  mockClient.response = { enabled: false, testing_only: true, pilot_accounts: [] };
  await saveSportQuizSettings({ enabled: false, pilot_accounts: [] }, 'Local test paused.');
  mockClient.response = { id: 'q1', question_key: 'key1', version: 1, status: 'draft' };
  await saveSportQuizQuestion('q1', 'void', { reason: 'Question wording is ambiguous.' });
  mockClient.response = { generated_at: '2026-10-14', week_start: '2026-10-12', week_end: '2026-10-19',
    settings: { enabled: false, testing_only: true, pilot_accounts: [], reason: 'Local testing paused.', updated_at: '2026-10-14', updated_by: null },
    questions: [], audit: [], next_before: null,
    counts: { questions_draft: 0, questions_approved: 0, questions_archived: 0, questions_void: 0, week_issued: 0, week_completed: 0, week_skipped: 0, week_void: 0, badges_issued: 0, badges_void: 0 } };
  await fetchSportQuizAdmin('9007199254740993');
  expect(mockClient.calls).toEqual([
    { fn: 'quiz_admin_settings', args: { p_payload: { enabled: false, pilot_accounts: [] }, p_reason: 'Local test paused.' } },
    { fn: 'quiz_admin_question', args: { p_id: 'q1', p_action: 'void', p_payload: { reason: 'Question wording is ambiguous.' } } },
    { fn: 'quiz_admin_snapshot', args: { p_before: '9007199254740993' } },
  ]);
});
it('rejects incomplete admin counts rather than showing missing values as a healthy report', async () => {
  mockClient.response = { settings: { enabled: false, testing_only: true, pilot_accounts: [] }, questions: [], audit: [], counts: {} };
  await expect(fetchSportQuizAdmin()).rejects.toThrow(/unavailable/i);
});
const validQuestion = { id:'q1',question_key:'key1',version:1,sport:'American football',prompt:'How many points is a touchdown before any conversion?',
  options:['3','6','7','2'],correct_option:1,explanation:'A touchdown scores six points.',status:'draft',reason:'Draft; human fact approval required.',
  created_at:'2026-10-14',created_by:null,reviewed_at:null,reviewed_by:null };
const validAdmin = { generated_at:'2026-10-14',week_start:'2026-10-12',week_end:'2026-10-19',
  settings:{ enabled:false,testing_only:true,pilot_accounts:[],reason:'Local testing paused.',updated_at:'2026-10-14',updated_by:null },
  questions:[validQuestion],audit:[],next_before:null,
  counts:{ questions_draft:1,questions_approved:0,questions_archived:0,questions_void:0,week_issued:0,week_completed:0,week_skipped:0,week_void:0,badges_issued:0,badges_void:0 } };
it.each([{}, { ...validQuestion,options:undefined }, { ...validQuestion,options:['3',6,'7','2'] }, { ...validQuestion,correct_option:4 }, { ...validQuestion,status:'active' }])(
  'rejects malformed question DTOs before the Data renderer receives them: %j', async question => {
    mockClient.response = { ...validAdmin, questions:[question] };
    await expect(fetchSportQuizAdmin()).rejects.toThrow(/unavailable/i);
  },
);
it.each([
  { generated_at:undefined }, { week_start:'not-a-date' }, { next_before:9007199254740992 },
  { audit:[{}] }, { settings:{ ...validAdmin.settings,updated_at:null } },
])('rejects malformed admin envelope/audit fields consumed by the desk: %j', async fields => {
  mockClient.response = { ...validAdmin,...fields };
  await expect(fetchSportQuizAdmin()).rejects.toThrow(/unavailable/i);
});
it('accepts the complete question and string bigint audit cursor without losing Data fields', async () => {
  mockClient.response = { ...validAdmin,next_before:'9007199254740993',audit:[{
    id:'9007199254740994',action:'question_create',actor_id:'admin-1',question_id:'q1',reason:'Draft question.',created_at:'2026-10-14',
  }] };
  expect(await fetchSportQuizAdmin()).toEqual(mockClient.response);
});
it('refuses malformed mutation receipts instead of allowing the desk to report success', async () => {
  mockClient.response = {};
  await expect(saveSportQuizQuestion('q1','approve',{ reason:'Human fact approval.' })).rejects.toThrow(/unavailable/i);
  mockClient.response = { enabled:false,testing_only:false,pilot_accounts:[] };
  await expect(saveSportQuizSettings({ enabled:false,pilot_accounts:[] },'Pause local testing.')).rejects.toThrow(/unavailable/i);
});

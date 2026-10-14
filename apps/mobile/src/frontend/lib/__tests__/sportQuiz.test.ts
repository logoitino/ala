/** QUIZ-01 adapter boundaries: real bound RPC calls, exact retry tokens and fail-closed data. Synthetic fixtures. */
import {
  answerSportQuiz, fetchSportQuiz, fetchSportQuizAdmin, saveSportQuizQuestion, saveSportQuizSettings,
  skipSportQuiz, startSportQuiz,
} from '@/lib/sportQuiz';
import * as timedQuiz from '@/lib/sportQuiz';

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
  mockClient.response = { contract_version:2, enabled: false, testing_only: true, pilot_accounts: [] };
  await saveSportQuizSettings({ enabled: false, pilot_accounts: [] }, 'Local test paused.', 'admin-profile');
  mockClient.response = { id: 'q1', question_key: 'key1', version: 1, status: 'draft' };
  await saveSportQuizQuestion('q1', 'void', { reason: 'Question wording is ambiguous.' }, 'admin-profile');
  mockClient.response = { generated_at: '2026-10-14', week_start: '2026-10-12', week_end: '2026-10-19',
    settings: { enabled: false, testing_only: true, pilot_accounts: [], reason: 'Local testing paused.', updated_at: '2026-10-14', updated_by: null },
    questions: [], audit: [], next_before: null,
    counts: { questions_draft: 0, questions_approved: 0, questions_archived: 0, questions_void: 0, week_issued: 0, week_completed: 0, week_skipped: 0, week_void: 0, badges_issued: 0, badges_void: 0 } };
  await fetchSportQuizAdmin('9007199254740993');
  expect(mockClient.calls).toEqual([
    { fn: 'quiz_admin_settings', args: { p_payload: { enabled: false, pilot_accounts: [] }, p_reason: 'Local test paused.', p_expected_actor_id:'admin-profile' } },
    { fn: 'quiz_admin_question', args: { p_id: 'q1', p_action: 'void', p_payload: { reason: 'Question wording is ambiguous.' }, p_expected_actor_id:'admin-profile' } },
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
  await expect(saveSportQuizQuestion('q1','approve',{ reason:'Human fact approval.' },'admin-profile')).rejects.toThrow(/unavailable/i);
  mockClient.response = { enabled:false,testing_only:false,pilot_accounts:[] };
  await expect(saveSportQuizSettings({ enabled:false,pilot_accounts:[] },'Pause local testing.','admin-profile')).rejects.toThrow(/unavailable/i);
});
it.each([' ','\t','\u00a0'])('keeps legacy semantic duplicate rows available for safe admin correction: %j', async suffix => {
  mockClient.response = { ...validAdmin,questions:[{ ...validQuestion,options:['3',`3${suffix}`,'7','2'] }] };
  expect((await fetchSportQuizAdmin()).questions[0].options).toEqual(['3',`3${suffix}`,'7','2']);
});
it('accepts all SQL-supported Unicode codepoint bounds rather than UTF-16 length', async () => {
  mockClient.response = { ...validAdmin,questions:[{ ...validQuestion,sport:'🏀'.repeat(41),prompt:'🏀'.repeat(141),explanation:'🏀'.repeat(251),reason:'🏀'.repeat(251),
    options:['🏀'.repeat(51),'6','7','2'] }] };
  expect(await fetchSportQuizAdmin()).toEqual(mockClient.response);
});
it('accepts SQL-supported minimum text with tabs without stripping source bytes', async () => {
  mockClient.response = { ...validAdmin,settings:{ ...validAdmin.settings,reason:'123456789\t' },
    questions:[{ ...validQuestion,sport:'1\t',prompt:'123456789\t',explanation:'123456789\t',reason:'123456789\t' }] };
  expect(await fetchSportQuizAdmin()).toEqual(mockClient.response);
});

describe('QUIZ-02 strict timed adapter', () => {
  it('rejects old or leaking timed snapshots instead of exposing an active prompt', async () => {
    mockClient.response = own;
    await expect(timedQuiz.fetchTimedSportQuiz()).rejects.toThrow(/unavailable/i);
    mockClient.response = { contract_version: 2, attempt: { question: { prompt: 'leak' } } };
    await expect(timedQuiz.fetchTimedSportQuiz()).rejects.toThrow(/unavailable/i);
  });
  it('keeps independent question and bigint audit cursors byte-for-byte', async () => {
    mockClient.response = null;
    await expect(timedQuiz.fetchTimedSportQuizAdmin({ question_cursor: 'opaque-question-cursor', audit_before: '9007199254740993' })).rejects.toThrow(/unavailable/i);
    expect(mockClient.calls).toEqual([{ fn: 'quiz_admin_snapshot', args: {
      p_question_cursor: 'opaque-question-cursor', p_audit_before: '9007199254740993',
    } }]);
  });
  const profile = '00000000-0000-0000-0000-000000000001';
  const request = '00000000-0000-0000-0000-000000000002';
  const preferences = { invitation_mode:'off',topic_mode:'sports',notice_version:null,notice_accepted_at:null,version:0,history_version:0,last_invited_week:null };
  const snapshot = { contract_version:2,profile_id:profile,server_now:'2026-10-14T00:00:00Z',week_start:'2026-10-12',week_end:'2026-10-19',
    testing_only:true,availability:'ready',preferences,attempt:null,week_spent:false,scheduled_topic:'sport',pools:[{topic_category:'sport',sport:'American football',unseen_count:1,allowed:true}],
    history_version:0,history_count:0,badge_count:0,correction_count:0 };
  const receipt = { contract_version:2,profile_id:profile,request_id:request,operation:'start',outcome:'issued',week_start:'2026-10-12',committed_at:'2026-10-14T00:00:00Z',attempt:null,result:null,preferences:null };
  const attempt = { id:'attempt',week_start:'2026-10-12',mode:'timed',status:'issued',started_at:'2026-10-14T00:00:00Z',expires_at:'2026-10-14T00:00:30Z',duration_seconds:30,closed_at:null,close_reason:null,effective_expired:false,correction_reason:null };
  const question = { id:'q1',question_key:'key1',version:1,topic_category:'sport',sport:'American football',prompt:validQuestion.prompt,options:validQuestion.options };
  const admin = { ...validAdmin,contract_version:2,settings:{...validAdmin.settings,contract_version:2},questions:[{...validQuestion,topic_category:'sport',source_notes:'Rule book confirms six points.'}],
    question_total:1,question_cap:100,next_question_cursor:null,pools:[{topic_category:'sport',sport:'American football',approved_count:1}],
    counts:{...validAdmin.counts,week_ended:0,week_expired:0,preferences_weekly:0,exposures:0,week_spent:0,retained_guards:0,retained_requests:0} };
  it('accepts the complete sanitized account source, but refuses leaked, missing and malformed fields', async () => {
    mockClient.response=snapshot; expect(await timedQuiz.fetchTimedSportQuiz()).toEqual(snapshot);
    for (const patch of [{attempt:{...attempt,question}}, {active_question:question}, {preferences:{...preferences,question}}, {result:{correct_option:1}}, {preferences:{}}, {history_count:-1}, {pools:[{}]}, {profile_id:123}]) {
      mockClient.response={...snapshot,...patch}; await expect(timedQuiz.fetchTimedSportQuiz()).rejects.toThrow(/unavailable/i);
    }
  });
  it('only accepts an active prompt in matching issued Start metadata, with exactly four safe options', async () => {
    const input = {topic_category:'sport' as const,sport:null,duration_seconds:30 as const,expected_week:'2026-10-12',notice_version:'timed-trivia-v1-testing' as const,request_id:request,session_secret:'a'.repeat(64),expected_profile_id:profile};
    const started={...receipt,attempt,server_now:snapshot.server_now,active_question:question};
    mockClient.response=started; expect(await timedQuiz.startTimedSportQuiz(input)).toEqual(started);
    expect(mockClient.calls[0]).toEqual({fn:'quiz_start',args:{p_topic_category:'sport',p_sport:null,p_duration_seconds:30,p_expected_week:'2026-10-12',p_notice_version:'timed-trivia-v1-testing',p_request_id:request,p_session_secret:'a'.repeat(64),p_expected_profile_id:profile}});
    for (const patch of [{active_question:{...question,options:['3']}}, {active_question:{...question,correct_option:1}}, {attempt:{...attempt,status:'ended'}}, {profile_id:'other'}]) {
      mockClient.response={...started,...patch}; await expect(timedQuiz.startTimedSportQuiz(input)).rejects.toThrow(/unavailable/i);
    }
  });
  it('preserves exact answer and End recovery while binding expected profile and omitting End secrets', async () => {
    mockClient.response={...receipt,operation:'answer',outcome:'completed',attempt:{...attempt,status:'completed',closed_at:snapshot.server_now},result:{answered_option:0,correct_option:1,was_correct:false,explanation:'A touchdown scores six points.',completed_at:snapshot.server_now}};
    const input={attempt_id:'attempt',option:0,request_id:request,session_secret:'a'.repeat(64),expected_profile_id:profile};
    await timedQuiz.answerTimedSportQuiz(input); await timedQuiz.answerTimedSportQuiz(input);
    expect(mockClient.calls[0]).toEqual(mockClient.calls[1]);
    mockClient.response={...receipt,operation:'end',outcome:'cancelled'};
    await timedQuiz.endTimedSportQuiz({attempt_id:null,start_request_id:request,expected_week:'2026-10-12',reason:'background',request_id:request,expected_profile_id:profile});
    expect(mockClient.calls[2]).toEqual({fn:'quiz_end',args:{p_attempt_id:null,p_start_request_id:request,p_expected_week:'2026-10-12',p_reason:'background',p_request_id:request,p_expected_profile_id:profile}});
  });
  it('maps preference/invitation/Skip and erasure compare-and-set inputs without inventing receipts', async () => {
    mockClient.response={...receipt,operation:'preferences',preferences:{...preferences,version:1}};
    await timedQuiz.saveTimedSportQuizPreferences({invitation_mode:'off',topic_mode:'sports',notice_version:'timed-trivia-v1-testing'},0,request,profile);
    mockClient.response={...receipt,operation:'invitation'}; await timedQuiz.claimTimedSportQuizInvitation('2026-10-12',request,profile);
    mockClient.response={...receipt,operation:'skip'}; await timedQuiz.skipTimedSportQuiz('2026-10-12',request,profile);
    mockClient.response={contract_version:2,profile_id:profile,history_version:1,week_start:'2026-10-12',week_spent:true,quota_prune_after:'2026-11-18T00:00:00Z',removed_attempts:1,removed_exposures:1,removed_badges:0,removed_requests:1,removed_audit:1};
    await timedQuiz.eraseTimedSportQuizHistory(0,profile);
    expect(mockClient.calls.map(c=>c.args)).toEqual([
      {p_payload:{invitation_mode:'off',topic_mode:'sports',notice_version:'timed-trivia-v1-testing'},p_expected_version:0,p_request_id:request,p_expected_profile_id:profile},
      {p_expected_week:'2026-10-12',p_request_id:request,p_expected_profile_id:profile},
      {p_expected_week:'2026-10-12',p_request_id:request,p_expected_profile_id:profile},
      {p_expected_history_version:0,p_expected_profile_id:profile},
    ]);
    mockClient.response={...(mockClient.response as object),removed_audit:undefined};
    await expect(timedQuiz.eraseTimedSportQuizHistory(0,profile)).rejects.toThrow(/unavailable/i);
  });
  it('rejects active question recovery on receipts/history and preserves terminal private history cursor', async () => {
    mockClient.response={...receipt,active_question:question}; await expect(timedQuiz.fetchTimedSportQuizReceipt(request)).rejects.toThrow(/unavailable/i);
    mockClient.response={...receipt,attempt,result:{answered_option:null,correct_option:1,was_correct:null,explanation:'A touchdown scores six points.',completed_at:null}};
    await expect(timedQuiz.fetchTimedSportQuizReceipt(request)).rejects.toThrow(/unavailable/i);
    const page={contract_version:2,profile_id:profile,server_now:snapshot.server_now,history_version:0,total:1,items:[{attempt:{...attempt,status:'ended',closed_at:snapshot.server_now},question,result:null,badge:null}],next_before:'opaque-history-cursor'};
    mockClient.response=page; expect(await timedQuiz.fetchTimedSportQuizHistory('original-cursor')).toEqual(page);
    expect(mockClient.calls.at(-1)).toEqual({fn:'quiz_history',args:{p_before:'original-cursor'}});
    mockClient.response={...page,items:[{...page.items[0],attempt}]}; await expect(timedQuiz.fetchTimedSportQuizHistory()).rejects.toThrow(/unavailable/i);
    mockClient.response={...page,items:[{...page.items[0],badge:{id:'badge',label:'Trivia Explorer',visibility:'public',issued_at:snapshot.server_now,voided_at:null}}]}; await expect(timedQuiz.fetchTimedSportQuizHistory()).rejects.toThrow(/unavailable/i);
    mockClient.response={...page,active_question:question};await expect(timedQuiz.fetchTimedSportQuizHistory()).rejects.toThrow(/unavailable/i);
    mockClient.response={...page,items:[{...page.items[0],attempt:{...page.items[0].attempt,mode:'legacy',status:'void'},question:{...question,options:['3','3\t','7','2']}}]};
    expect((await timedQuiz.fetchTimedSportQuizHistory()).items).toHaveLength(1);
  });
  it('accepts paged admin totals/effective counts, including malformed legacy choices for correction', async () => {
    mockClient.response=admin; expect(await timedQuiz.fetchTimedSportQuizAdmin()).toEqual(admin);
    mockClient.response={...admin,questions:[{...admin.questions[0],options:['3','3\t','7','2']}]}; expect((await timedQuiz.fetchTimedSportQuizAdmin()).questions).toHaveLength(1);
    for(const patch of [{question_total:0},{question_cap:101},{questions:Array(51).fill(admin.questions[0])},{counts:{...admin.counts,week_expired:undefined}},{questions:[{}]},{audit:[{}]}]) {
      mockClient.response={...admin,...patch}; await expect(timedQuiz.fetchTimedSportQuizAdmin()).rejects.toThrow(/unavailable/i);
    }
  });
  it('binds retention reason and refuses malformed cleanup counts', async () => {
    mockClient.response={contract_version:2,removed_guards:2,removed_requests:3,preserved_guards:4,batch_limit:500};
    expect(await timedQuiz.pruneTimedSportQuizHistory('Remove expired recovery records.',profile)).toEqual(mockClient.response);
    expect(mockClient.calls[0]).toEqual({fn:'quiz_admin_retention',args:{p_reason:'Remove expired recovery records.',p_expected_actor_id:profile}});
    mockClient.response={contract_version:2,removed_guards:-1,removed_requests:3,preserved_guards:4,batch_limit:500};
    await expect(timedQuiz.pruneTimedSportQuizHistory('Remove expired recovery records.',profile)).rejects.toThrow(/unavailable/i);
  });
  const terminalAttempt={...attempt,status:'completed',closed_at:snapshot.server_now};
  const terminalResult={answered_option:0,correct_option:1,was_correct:false,explanation:'A touchdown scores six points.',completed_at:snapshot.server_now};
  const history={contract_version:2,profile_id:profile,server_now:snapshot.server_now,history_version:0,total:1,
    items:[{attempt:terminalAttempt,question,result:terminalResult,badge:{id:'badge',label:'Trivia Explorer',visibility:'private',issued_at:snapshot.server_now,voided_at:null}}],next_before:null};
  const startInput={topic_category:'sport' as const,sport:null,duration_seconds:30 as const,expected_week:'2026-10-12',notice_version:'timed-trivia-v1-testing' as const,request_id:request,session_secret:'a'.repeat(64),expected_profile_id:profile};
  const erased={contract_version:2,profile_id:profile,history_version:1,week_start:'2026-10-12',week_spent:true,quota_prune_after:'2026-11-18T00:00:00Z',removed_attempts:1,removed_exposures:1,removed_badges:1,removed_requests:1,removed_audit:1};
  const retention={contract_version:2,removed_guards:2,removed_requests:3,preserved_guards:4,batch_limit:500};
  const secretContexts=[
    {name:'snapshot SQL session_hash',payload:{...snapshot,session_hash:'hash'},call:()=>timedQuiz.fetchTimedSportQuiz()},
    {name:'nested snapshot session_hash',payload:{...snapshot,preferences:{...preferences,debug:[{session_hash:'hash'}]}},call:()=>timedQuiz.fetchTimedSportQuiz()},
    {name:'ordinary receipt nested session_hash',payload:{...receipt,preferences:{...preferences,debug:{session_hash:'hash'}}},call:()=>timedQuiz.fetchTimedSportQuizReceipt(request)},
    {name:'Start question session_hash',payload:{...receipt,attempt,server_now:snapshot.server_now,active_question:{...question,session_hash:'hash'}},call:()=>timedQuiz.startTimedSportQuiz(startInput)},
    {name:'terminal history nested session_hash',payload:{...history,items:[{...history.items[0],badge:{...history.items[0].badge,debug:{session_hash:'hash'}}}]},call:()=>timedQuiz.fetchTimedSportQuizHistory()},
    {name:'admin question session_hash',payload:{...admin,questions:[{...admin.questions[0],session_hash:'hash'}]},call:()=>timedQuiz.fetchTimedSportQuizAdmin()},
    {name:'settings receipt nested token hash',payload:{contract_version:2,enabled:false,testing_only:true,pilot_accounts:[],debug:{token_hash:'hash'}},call:()=>saveSportQuizSettings({enabled:false,pilot_accounts:[]},'Pause for protected review.',profile)},
    {name:'question receipt session_hash',payload:{id:'q1',question_key:'key1',version:1,status:'draft',session_hash:'hash'},call:()=>saveSportQuizQuestion(null,'create',{reason:'Create a reviewed draft.'},profile)},
    {name:'retention session_hash',payload:{...retention,debug:{session_hash:'hash'}},call:()=>timedQuiz.pruneTimedSportQuizHistory('Prune expired recovery records.',profile)},
    {name:'erasure session_hash',payload:{...erased,debug:{session_hash:'hash'}},call:()=>timedQuiz.eraseTimedSportQuizHistory(0,profile)},
  ];
  it.each(secretContexts)('T2-I1 rejects actual hash/capability fields recursively: $name',async({payload,call})=>{
    mockClient.response=payload;await expect(call()).rejects.toThrow(/unavailable/i);
  });
  it.each([
    {preferences:{...preferences,active_question:{prompt:'not allowed'}}},
    {preferences:{...preferences,debug:{active_question:{prompt:'not allowed'}}}},
    {preferences:{...preferences,debug:[{attempt:{question:{prompt:'not allowed'}}}]}},
    {debug:{result:{explanation:'not authorized here'}}},
    {result:{...terminalResult,debug:{active_question:{prompt:'not allowed'}}},attempt:terminalAttempt},
  ])('T2-I1 rejects active learning in unauthorized ordinary receipt locations: %j',async patch=>{
    mockClient.response={...receipt,operation:'preferences',preferences,...patch};
    await expect(timedQuiz.fetchTimedSportQuizReceipt(request)).rejects.toThrow(/unavailable/i);
  });
  const participantAudit={id:'8',action:'start',actor_id:null,question_id:null,reason:null,created_at:snapshot.server_now};
  it.each([
    {...participantAudit,actor_id:profile,question_id:'q1',attempt_id:'attempt'},
    {...participantAudit,actor_id:profile},
    {...participantAudit,question_id:'q1'},
    {...participantAudit,attempt_id:'attempt'},
    {...participantAudit,debug:{request_id:request}},
    {...participantAudit,debug:[{links:{attempt_id:'attempt'}}]},
    {...participantAudit,action:'settings',actor_id:profile,question_id:'q1'},
    {...participantAudit,action:'question_void',actor_id:profile,question_id:'q1',debug:{request_id:request}},
  ])('T2-I1 rejects participant audit graphs and unauthorized admin links: %j',async audit=>{
    mockClient.response={...admin,audit:[audit]};await expect(timedQuiz.fetchTimedSportQuizAdmin()).rejects.toThrow(/unavailable/i);
  });
  it('T2-I1 projects ordinary snapshot/receipt fields and preserves terminal result explanation',async()=>{
    mockClient.response={...snapshot,debug:{message:'benign'},preferences:{...preferences,debug:{message:'benign'}}};
    expect(await timedQuiz.fetchTimedSportQuiz()).toEqual(snapshot);
    const completed={...receipt,operation:'answer',attempt:terminalAttempt,result:terminalResult};
    mockClient.response={...completed,debug:{message:'benign'},result:{...terminalResult,debug:{message:'benign'}}};
    expect(await timedQuiz.fetchTimedSportQuizReceipt(request)).toEqual(completed);
  });
  it('T2-I1 projects live Start and own terminal history, preserving private legacy correction bytes',async()=>{
    const started={...receipt,attempt,server_now:snapshot.server_now,active_question:question};
    mockClient.response={...started,active_question:{...question,debug:{message:'benign'}}};
    expect(await timedQuiz.startTimedSportQuiz(startInput)).toEqual(started);
    const legacy={...history,items:[{...history.items[0],attempt:{...terminalAttempt,mode:'legacy',status:'void',correction_reason:'Duplicate choices corrected.'},
      question:{...question,options:['3','3\t','7','2']},badge:{...history.items[0].badge,label:'Sport Learner',voided_at:snapshot.server_now}}]};
    mockClient.response={...legacy,debug:{message:'benign'},items:[{...legacy.items[0],debug:{message:'benign'},question:{...legacy.items[0].question,debug:{message:'benign'}}}]};
    expect(await timedQuiz.fetchTimedSportQuizHistory()).toEqual(legacy);
  });
  it('T2-I1 permits redacted participant audit and explicit editorial/stop provenance only',async()=>{
    const allowed={...admin,audit:[participantAudit,{...participantAudit,id:'9',action:'question_void',actor_id:profile,question_id:'q1',reason:'Void erroneous wording.'},
      {...participantAudit,id:'10',action:'settings',actor_id:profile,reason:'Pause for protected review.'}]};
    mockClient.response={...allowed,debug:{message:'benign'},questions:[{...allowed.questions[0],debug:{message:'benign'}}],audit:allowed.audit.map(a=>({...a,debug:{message:'benign'}}))};
    expect(await timedQuiz.fetchTimedSportQuizAdmin()).toEqual(allowed);
  });
  it('T2-I1 projects mutation and erasure/retention receipts without unknown nested data',async()=>{
    const settings={contract_version:2,enabled:false,testing_only:true,pilot_accounts:[]};
    mockClient.response={...settings,debug:{message:'benign'}};
    expect(await saveSportQuizSettings({enabled:false,pilot_accounts:[]},'Pause for protected review.',profile)).toEqual(settings);
    const saved={id:'q1',question_key:'key1',version:1,status:'draft'};
    mockClient.response={...saved,debug:{message:'benign'}};
    expect(await saveSportQuizQuestion(null,'create',{reason:'Create a reviewed draft.'},profile)).toEqual(saved);
    mockClient.response={...erased,debug:{message:'benign'}};expect(await timedQuiz.eraseTimedSportQuizHistory(0,profile)).toEqual(erased);
    mockClient.response={...retention,debug:{message:'benign'}};expect(await timedQuiz.pruneTimedSportQuizHistory('Prune expired recovery records.',profile)).toEqual(retention);
  });
});

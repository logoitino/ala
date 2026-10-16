/** QUIZ-03 adapter boundaries: rounds with Next, question types, group pages without per-member detail, badges, recap and admin group desk. Synthetic fixtures. */
import * as quiz from '@/lib/sportQuiz';

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
const group = '00000000-0000-0000-0000-000000000003';
const now = '2026-10-14T17:00:00.000Z';
const later = '2026-10-14T17:00:30.000Z';
const round = { id:'attempt',week_start:'2026-10-12',mode:'round',status:'issued',started_at:now,expires_at:later,duration_seconds:30,closed_at:null,close_reason:null,
  effective_expired:false,correction_reason:null,round_state:'item',position:2,planned_items:5,round_size:5,next_by:null,answered_count:1,short_round:false,group_id:null };
const question = { id:'q2',question_key:'k2',version:1,topic_category:'sport',sport:'Volleyball',prompt:'A team may touch the ball three times before returning it.',options:['True','False'],question_type:'true_false' };
const receipt = { contract_version:2,profile_id:profile,request_id:request,operation:'next',outcome:'issued',week_start:'2026-10-12',committed_at:now,attempt:round,result:null,preferences:null };
const nextInput = { attempt_id:'attempt',expected_position:1,request_id:request,session_secret:'a'.repeat(64),expected_profile_id:profile };

describe('QUIZ-03 Next and rounds', () => {
  it('sends the exact recovery tuple and accepts the open item only with matching round metadata', async () => {
    const issued = { ...receipt, server_now:now, active_question:question, active_item:{ position:2, planned_items:5, expires_at:later } };
    mockClient.response = issued;
    expect(await quiz.nextTriviaItem(nextInput)).toEqual(issued);
    expect(mockClient.calls[0]).toEqual({ fn:'quiz_next', args:{ p_attempt_id:'attempt', p_expected_position:1, p_request_id:request, p_session_secret:'a'.repeat(64), p_expected_profile_id:profile } });
    for (const patch of [
      { active_item:{ position:2, planned_items:5, expires_at:'2026-10-14T16:59:00.000Z' } }, // already past its deadline
      { active_item:null },
      { attempt:{ ...round, round_state:'between' } },
      { active_question:{ ...question, correct_option:0 } },
      { active_question:{ ...question, options:['True','False','Maybe'] } },
      { operation:'start' },
    ]) { mockClient.response = { ...issued, ...patch }; await expect(quiz.nextTriviaItem(nextInput)).rejects.toThrow(/unavailable/i); }
  });
  it('accepts a closed Next (no question) and refuses an item without a question', async () => {
    mockClient.response = { ...receipt, outcome:'completed', attempt:{ ...round, status:'completed', round_state:null, closed_at:now }, server_now:now, active_question:null, active_item:null,
      result:{ answered_option:0,correct_option:0,was_correct:true,explanation:'Three contacts are allowed per side.',completed_at:now,position:1,item_status:'answered' } };
    expect((await quiz.nextTriviaItem(nextInput)).active_question).toBeNull();
    mockClient.response = { ...receipt, server_now:now, active_question:null, active_item:{ position:2, planned_items:5, expires_at:later } };
    await expect(quiz.nextTriviaItem(nextInput)).rejects.toThrow(/unavailable/i);
  });
  it('lets an answer receipt carry a result while the round waits for Next, never while an item is open', async () => {
    const result = { answered_option:1,correct_option:0,was_correct:false,explanation:'Three contacts are allowed per side.',completed_at:now,position:1,item_status:'answered' };
    const between = { ...receipt, operation:'answer', outcome:'answered', attempt:{ ...round, position:1, round_state:'between', next_by:'2026-10-14T17:02:00.000Z' }, result };
    mockClient.response = between;
    expect((await quiz.answerTimedSportQuiz({ attempt_id:'attempt',option:1,request_id:request,session_secret:'a'.repeat(64),expected_profile_id:profile })).result).toEqual(result);
    mockClient.response = { ...between, attempt:{ ...round, position:1 } };
    await expect(quiz.answerTimedSportQuiz({ attempt_id:'attempt',option:1,request_id:request,session_secret:'a'.repeat(64),expected_profile_id:profile })).rejects.toThrow(/unavailable/i);
  });
  it('group Start uses the group RPC and requires position 1', async () => {
    const started = { ...receipt, operation:'start', outcome:'started', attempt:{ ...round, position:1, group_id:group }, server_now:now, active_question:question, active_item:{ position:1, planned_items:5, expires_at:later } };
    const input = { group_id:group,duration_seconds:30 as const,expected_week:'2026-10-12',notice_version:'timed-trivia-v1-testing' as const,request_id:request,session_secret:'a'.repeat(64),expected_profile_id:profile };
    mockClient.response = started; expect((await quiz.startTriviaGroupRound(input)).attempt?.group_id).toBe(group);
    expect(mockClient.calls[0].fn).toBe('quiz_group_start');
    mockClient.response = { ...started, active_item:{ position:2, planned_items:5, expires_at:later } };
    await expect(quiz.startTriviaGroupRound(input)).rejects.toThrow(/unavailable/i);
  });
});

describe('QUIZ-03 question types', () => {
  it('checks options by type', () => {
    expect(quiz.sportQuizOptionsIssue(['True','False'],'true_false')).toBeNull();
    expect(quiz.sportQuizOptionsIssue(['Yes','No'],'true_false')).not.toBeNull();
    expect(quiz.sportQuizOptionsIssue(['a','b','c'])).not.toBeNull();
    expect(quiz.sportQuizOptionsIssue(['a','b','c'],'image_choice')).toBeNull();
    expect(quiz.sportQuizMediaIssue({ media_path:'equipment/ball.webp',media_licence:'owned',media_source:'Staff photo',media_attribution:'Staff',media_alt_text:'A ball on a court floor',media_size_bytes:300000,media_has_person:false,media_no_marks:true,media_exif_stripped:true })).toBeNull();
    expect(quiz.sportQuizMediaIssue({ media_path:'equipment/ball.webp',media_licence:'owned',media_source:'Staff photo',media_attribution:'Staff',media_alt_text:'A ball on a court floor',media_size_bytes:300000,media_has_person:false,media_no_marks:true })).toMatch(/EXIF/);
    expect(quiz.sportQuizMediaIssue({ media_path:'equipment/ball.webp',media_licence:'owned',media_source:'Staff photo',media_attribution:'Staff',media_alt_text:'A ball on a court floor',media_size_bytes:300000,media_has_person:false,media_exif_stripped:true })).toMatch(/marks/);
    expect(quiz.sportQuizMediaIssue({ media_path:'equipment/ball.webp',media_licence:'owned',media_source:'Staff photo',media_attribution:'Staff',media_alt_text:'A ball on a court floor',media_size_bytes:400000,media_has_person:false })).toMatch(/300 KB/);
    expect(quiz.sportQuizMediaIssue({ media_path:'equipment/ball.webp',media_licence:'owned',media_source:'Staff photo',media_attribution:'Staff',media_alt_text:'A ball on a court floor',media_size_bytes:1,media_has_person:true })).toMatch(/person/);
    expect(quiz.sportQuizMediaIssue({ media_path:'equipment/ball.webp',media_licence:'owned',media_source:'Staff photo',media_attribution:'Staff',media_alt_text:'A volleyball on a court',media_size_bytes:1,media_has_person:false },'Volleyball')).toMatch(/reveal/);
  });
});

const page = { contract_version:3,group_id:group,name_key:'family',theme_sport:null,status:'active',is_owner:false,week_start:'2026-10-12',
  members:[{ member_ref:null,display_name:'Ana',is_owner:true,is_me:false,played_this_week:true,badges:['Family Challenger'] },{ member_ref:null,display_name:'Ben',is_owner:false,is_me:true,played_this_week:false,badges:[] }],
  totals:{ members:2,played_this_week:1,facts_this_week:null,facts_this_season:null },everyone_played:false,code_active:true,code_expires_at:null,can_invite:false,outcome:'member' };
describe('QUIZ-03 groups', () => {
  it('accepts a group page with played marks and totals only', async () => {
    mockClient.response = page; expect(await quiz.fetchTriviaGroup(group)).toEqual(page);
    const shown = { ...page, totals:{ ...page.totals, played_this_week:3, facts_this_week:5, facts_this_season:20 } };
    mockClient.response = shown; expect((await quiz.fetchTriviaGroup(group)).outcome).toBe('member');
  });
  it.each([
    ['a per-member fact count', { members:[{ ...page.members[0], facts_this_week:3 }, page.members[1]] }],
    ['an answer on a member', { members:[{ ...page.members[0], answered_option:1 }, page.members[1]] }],
    ['member ids to a non-owner', { members:[{ ...page.members[0], member_ref:profile }, page.members[1]] }],
    ['the code expiry to a non-owner', { code_expires_at:later }],
    ['a thirteenth member', { members:Array(13).fill(page.members[1]) }],
    ['an extra total', { totals:{ ...page.totals, fastest:1 } }],
    ['an exact (unrounded) fact total', { totals:{ ...page.totals, facts_this_week:4 } }],
    ['members of a closed group', { status:'closed' }],
    ['a raw profile id as member_ref, even to the owner', { is_owner:true, members:[{ ...page.members[0], member_ref:profile }, page.members[1]] }],
    ['a free-text group name', { name_key:'Best family ever' }],
  ])('refuses %s', async (_label, patch) => {
    mockClient.response = { ...page, ...patch }; await expect(quiz.fetchTriviaGroup(group)).rejects.toThrow(/unavailable/i);
  });
  it('returns only the removal notice for a removed member', async () => {
    mockClient.response = { contract_version:3,group_id:group,name_key:'family',outcome:'removed' };
    expect(await quiz.fetchTriviaGroup(group)).toEqual({ contract_version:3,group_id:group,name_key:'family',outcome:'removed' });
    mockClient.response = { contract_version:3,group_id:group,name_key:'family',outcome:'removed',reason:'blocked' };
    await expect(quiz.fetchTriviaGroup(group)).rejects.toThrow(/unavailable/i);
  });
  it('create returns the one-time code; join keeps every refusal identical', async () => {
    mockClient.response = { ...page, is_owner:true, members:page.members.map(m => ({ ...m, member_ref:'ab'.repeat(16) })), code_expires_at:later, code:'ABCD2345', code_shown:true };
    expect((await quiz.createTriviaGroup('family', null, request, profile)).code).toBe('ABCD2345');
    expect(mockClient.calls[0]).toEqual({ fn:'quiz_group_create', args:{ p_name_key:'family', p_theme_sport:null, p_request_id:request, p_expected_profile_id:profile } });
    mockClient.response = { ...page, is_owner:true, code_expires_at:later, code:'abc', code_shown:true };
    await expect(quiz.createTriviaGroup('family', null, request, profile)).rejects.toThrow(/unavailable/i);
    mockClient.response = { contract_version:3, outcome:'refused', group:null };
    expect(await quiz.joinTriviaGroup('ZZZZZZZZ', profile)).toEqual({ contract_version:3, outcome:'refused', group:null });
    mockClient.response = { contract_version:3, outcome:'refused', group:page };
    await expect(quiz.joinTriviaGroup('ZZZZZZZZ', profile)).rejects.toThrow(/unavailable/i);
    mockClient.response = { contract_version:3, outcome:'joined', group:page };
    expect((await quiz.joinTriviaGroup('ABCD2345', profile)).group?.totals.members).toBe(2);
  });
  it('wraps leave, removal, renew, theme, report and my groups with exact arguments', async () => {
    mockClient.response = { contract_version:3, outcome:'left' }; await quiz.leaveTriviaGroup(group, profile);
    mockClient.response = { ...page, is_owner:true, code_expires_at:later, code:'EFGH6789' }; expect((await quiz.removeTriviaGroupMember(group, 'cd'.repeat(16), profile)).code).toBe('EFGH6789');
    mockClient.response = { contract_version:3, group_id:group, code:'JKLM2345', expires_at:later }; await quiz.renewTriviaGroupCode(group, profile);
    mockClient.response = page; await quiz.setTriviaGroupTheme(group, 'Rugby', profile);
    mockClient.response = { contract_version:3, outcome:'reported', group_id:group }; await quiz.reportTriviaGroup(group, 'safety', profile);
    mockClient.response = { contract_version:3, profile_id:profile, week_start:'2026-10-12', groups_enabled:true,
      groups:[{ group_id:group,name_key:'family',theme_sport:null,is_owner:false,members:2,played_this_week:true,everyone_played:false }], removed:[],
      limits:{ created:0,create_limit:3,belong:1,belong_limit:5,max_members:12 } };
    expect((await quiz.fetchMyTriviaGroups()).groups).toHaveLength(1);
    expect(mockClient.calls.map(c => c.fn)).toEqual(['quiz_group_leave','quiz_group_remove_member','quiz_group_renew_code','quiz_group_set_theme','quiz_group_report','quiz_groups_mine']);
    expect(mockClient.calls[1].args).toEqual({ p_group_id:group, p_member_ref:'cd'.repeat(16), p_expected_profile_id:profile });
  });
});

describe('QUIZ-03 badges, recap and admin group desk', () => {
  const badge = { id:'b1',label:'Basketball Explorer',kind:'sport',sport:'Basketball',period:'lifetime',visibility:'private',issued_at:now };
  it('reads the shelf and changes one badge visibility', async () => {
    mockClient.response = { contract_version:3, profile_id:profile, badges:[badge] }; expect((await quiz.fetchTriviaBadgeShelf()).badges[0].label).toBe('Basketball Explorer');
    mockClient.response = { ...badge, visibility:'groups', contract_version:3 }; expect((await quiz.setTriviaBadgeVisibility('b1','groups',profile)).visibility).toBe('groups');
    mockClient.response = { ...badge, visibility:'public', contract_version:3 }; await expect(quiz.setTriviaBadgeVisibility('b1','groups',profile)).rejects.toThrow(/unavailable/i);
  });
  it('reads an own season recap and refuses a malformed quarter', async () => {
    const recap = { contract_version:3,profile_id:profile,quarter:'2026-Q4',starts_on:'2026-10-01',ends_before:'2027-01-01',facts:23,sports:4,rounds:6,badges:3,
      per_sport:[{ sport:'Basketball',facts:10 }],per_topic:[{ topic_category:'sport',facts:23 }] };
    mockClient.response = recap; expect(await quiz.fetchTriviaSeasonRecap()).toEqual(recap);
    mockClient.response = { ...recap, quarter:'2026-13' }; await expect(quiz.fetchTriviaSeasonRecap()).rejects.toThrow(/unavailable/i);
  });
  it('admin play settings, case view (no names) and removal', async () => {
    mockClient.response = { contract_version:3, round_size:3, groups_enabled:true, images_enabled:false };
    expect(await quiz.saveTriviaPlaySettings({ round_size:3, groups_enabled:true, images_enabled:false }, 'Owner approved rounds of three.', profile)).toEqual(mockClient.response);
    const file = { contract_version:3,generated_at:now,group_id:group,group:null,members:[{ profile_id:profile,age_band:'teen_13_15',status:'active',joined_at:now,removed_at:null,removed_reason:null,is_owner:true }],
      refusals:[{ profile_id:request,age_band:'adult',refusal_reason:'teen_rule',created_at:now }],cases:[] };
    mockClient.response = file; expect((await quiz.fetchTriviaGroupCase(group, 'Reviewing a safety report.', profile)).refusals[0].refusal_reason).toBe('teen_rule');
    mockClient.response = { ...file, members:[{ ...file.members[0], full_name:'Leak Name' }] };
    await expect(quiz.fetchTriviaGroupCase(group, 'Reviewing a safety report.', profile)).rejects.toThrow(/unavailable/i);
    mockClient.response = { contract_version:3, outcome:'closed', group_id:group, profile_id:null };
    expect((await quiz.removeFromTriviaGroup(group, null, 'Closed after review.', profile)).outcome).toBe('closed');
  });
  it('admin snapshot accepts the 300 cap, forecast, group counts and reports, and refuses an over-cap active total', async () => {
    const counts = { questions_draft:1,questions_approved:0,questions_archived:0,questions_void:0,week_issued:0,week_completed:0,week_skipped:0,week_void:0,badges_issued:0,badges_void:0,
      week_ended:0,week_expired:0,preferences_weekly:0,exposures:0,week_spent:0,retained_guards:0,retained_requests:0,week_items_answered:4,badges_sport:1 };
    const groups = { groups_active:1,groups_closed:0,members_active:3,members_removed:0,groups_played_this_week:1,codes_active:1,codes_issued:1,joins_7d:2,refusals_7d:1,wrong_codes_7d:0,reports_7d:1,sets_this_week:1,retained_sets:5,retained_join_attempts:3 };
    const snapshot = { contract_version:2,generated_at:now,week_start:'2026-10-12',week_end:'2026-10-19',
      settings:{ contract_version:2,enabled:false,testing_only:true,pilot_accounts:[],reason:'Paused for testing.',updated_at:now,updated_by:null,round_size:5,groups_enabled:false,images_enabled:false },
      questions:[],question_total:320,active_total:12,question_cap:300,next_question_cursor:null,audit:[],next_before:null,pools:[],counts,
      forecast:[{ sport:'Rugby',approved_families:4,players_28d:0,issued_28d:0,pace_per_player_week:0,max_seen:0,weeks_left:null }],groups,
      reports:[{ id:'7',group_id:group,reason_code:'safety',created_at:now }] };
    mockClient.response = snapshot; const s = await quiz.fetchTimedSportQuizAdmin();
    expect(s.forecast?.[0].weeks_left).toBeNull(); expect(s.groups?.members_active).toBe(3); expect(s.active_total).toBe(12);
    mockClient.response = { ...snapshot, active_total:301 }; await expect(quiz.fetchTimedSportQuizAdmin()).rejects.toThrow(/unavailable/i);
    mockClient.response = { ...snapshot, groups:{ ...groups, members_active:-1 } }; await expect(quiz.fetchTimedSportQuizAdmin()).rejects.toThrow(/unavailable/i);
    mockClient.response = { ...snapshot, settings:{ ...snapshot.settings, round_size:6 } }; await expect(quiz.fetchTimedSportQuizAdmin()).rejects.toThrow(/unavailable/i);
  });
});

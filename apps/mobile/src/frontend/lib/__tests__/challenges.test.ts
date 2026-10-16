/**
 * CHAL-01 client: every wrapper sends the exact SQL argument names, the shared parsers read hidden counts as null and
 * drop free text or unknown values, and an unapplied migration reads as "not switched on". Synthetic data.
 */
const mockRpc = jest.fn();
jest.mock('@/lib/supabase', () => ({ isSupabaseConfigured: true, supabase: { rpc: (...args: unknown[]) => mockRpc(...args) } }));

import {
  CHALLENGE_LIMITS,
  CHALLENGE_PRESET_LABEL,
  challengeInviteText,
  parseAdminChallengePosts,
  parseAdminChallengeSenders,
  parseAdminChallengeStatus,
  parseChallengeCounts,
  parseChallengeInvites,
  parseChallengeStatus,
} from '@tapuai/shared-types/challenges';

import {
  adminChallengeErase,
  adminChallengeRetention,
  adminHoldChallengeSender,
  adminSetChallengesEnabled,
  exportMyChallengeData,
  fetchAdminChallengePosts,
  fetchAdminChallengeSenders,
  fetchAdminChallengeStatus,
  fetchChallengeCounts,
  fetchChallengeInbox,
  fetchChallengeFriends,
  fetchMyChallengeStatus,
  inviteFriendToChallenge,
  respondToChallenge,
  setAllowChallenges,
  setChallengeMute,
} from '@/lib/challenges';
import { describeEvent, parseSupervision } from '@/lib/minors';
import { NOT_SWITCHED_ON } from '@/lib/rpc';

const countsRaw={enabled:false,eligible:false,reason:'switched_off',visible:false,counts:null,total:null,mine:null};
const statusRaw={enabled:false,is_athlete:false,allow_challenges:false,allow_default:false,allow_set:false,muted_all:false,muted_senders:[],badges:[]};
const exportRaw={response_quota:[],responses:[],invites_sent:[],invites_received:[],mutes:[],badges:[],athlete_setting:null};
const erasedRaw={responses:2,invites:3,mutes:0,badges:0,settings:0,holds:0,response_quota:0,audit_identities:0};
const adminRaw={switched_on:false,live:false,missing:[],changed_at:null,change_reason:null,totals:{responses:0,responders:0,invites_7d:0,invites_dropped_7d:0,badges:0,senders_held:0,athletes_on:0,athletes_off:0}};
beforeEach(() => mockRpc.mockReset().mockImplementation(async(name:string,input:Record<string,unknown>)=>({data:
 name==='challenge_counts'||name==='challenge_respond'?countsRaw:
 name==='challenge_inbox'||name==='admin_challenge_post_counts'||name==='admin_challenge_nudge_senders'?[]:
 name==='challenge_export_my_data'?exportRaw:
 name==='admin_challenge_status'||name==='admin_set_challenges_enabled'?adminRaw:
 name==='admin_hold_challenge_sender'?{sender_id:input.sender_profile_id,hold:input.hold==='clear'?null:input.hold}:statusRaw,error:null})));

it('sends the exact argument names for every participant call', async () => {
  await fetchChallengeCounts('r1', 'actor-a');
  expect(mockRpc).toHaveBeenLastCalledWith('challenge_counts', { expected_actor_id: 'actor-a', target_reel_id: 'r1' });
  await respondToChallenge('r1', 'did_it', 'actor-a');
  expect(mockRpc).toHaveBeenLastCalledWith('challenge_respond', { expected_actor_id: 'actor-a', target_reel_id: 'r1', preset: 'did_it' });
  await respondToChallenge('r1', null, 'actor-a');
  expect(mockRpc).toHaveBeenLastCalledWith('challenge_respond', { expected_actor_id: 'actor-a', target_reel_id: 'r1', preset: null });
  mockRpc.mockResolvedValueOnce({ data: { status: 'sent', sent_today: 3, daily_limit: 5 }, error: null });
  await expect(inviteFriendToChallenge('r1', 'p2', 'actor-a')).resolves.toEqual({ sentToday: 3, dailyLimit: 5 });
  expect(mockRpc).toHaveBeenLastCalledWith('challenge_invite', { expected_actor_id: 'actor-a', target_reel_id: 'r1', friend_profile_id: 'p2' });
  await setChallengeMute(null, true, 'actor-a');
  expect(mockRpc).toHaveBeenLastCalledWith('challenge_mute', { expected_actor_id: 'actor-a', sender_profile_id: null, mute: true });
  await fetchChallengeInbox(undefined, 'actor-a');
  expect(mockRpc).toHaveBeenLastCalledWith('challenge_inbox', { expected_actor_id: 'actor-a', max_rows: 30 });
  await fetchMyChallengeStatus('actor-a');
  expect(mockRpc).toHaveBeenLastCalledWith('challenge_my_status', { expected_actor_id: 'actor-a' });
  await setAllowChallenges(false, 'actor-a');
  expect(mockRpc).toHaveBeenLastCalledWith('set_allow_challenges', { expected_actor_id: 'actor-a', allow: false });
  mockRpc.mockResolvedValueOnce({ data: exportRaw, error: null });
  await expect(exportMyChallengeData('actor-a')).resolves.toEqual(exportRaw);
  expect(mockRpc).toHaveBeenLastCalledWith('challenge_export_my_data', { expected_actor_id: 'actor-a' });
});

it('sends the exact argument names for every admin call, trimming reasons', async () => {
  await fetchAdminChallengeStatus('actor-a');
  expect(mockRpc).toHaveBeenLastCalledWith('admin_challenge_status', { expected_actor_id: 'actor-a' });
  await adminSetChallengesEnabled(true, '  Owner approved  ', 'actor-a');
  expect(mockRpc).toHaveBeenLastCalledWith('admin_set_challenges_enabled', { expected_actor_id: 'actor-a', turn_on: true, reason: 'Owner approved' });
  await fetchAdminChallengePosts(undefined, 'actor-a');
  expect(mockRpc).toHaveBeenLastCalledWith('admin_challenge_post_counts', { expected_actor_id: 'actor-a', max_rows: 50 });
  await fetchAdminChallengeSenders(14, 'actor-a');
  expect(mockRpc).toHaveBeenLastCalledWith('admin_challenge_nudge_senders', { expected_actor_id: 'actor-a', days: 14 });
  await adminHoldChallengeSender('s1', 'suspend', 'Spam reports', 'actor-a');
  expect(mockRpc).toHaveBeenLastCalledWith('admin_hold_challenge_sender', { expected_actor_id: 'actor-a', sender_profile_id: 's1', hold: 'suspend', reason: 'Spam reports' });
  mockRpc.mockResolvedValueOnce({ data: { invites: 4, admin_records: 1, response_quota: 2 }, error: null });
  await expect(adminChallengeRetention('actor-a')).resolves.toEqual({ invites: 4, adminRecords: 1 });
  mockRpc.mockResolvedValueOnce({ data: erasedRaw, error: null });
  await expect(adminChallengeErase(' p9 ', 'Deletion request', 'actor-a')).resolves.toEqual(erasedRaw);
  expect(mockRpc).toHaveBeenLastCalledWith('admin_challenge_erase', { expected_actor_id: 'actor-a', target_profile_id: 'p9', reason: 'Deletion request' });
});

it('an unapplied migration reads as "not switched on"; a server refusal keeps its words', async () => {
  mockRpc.mockResolvedValueOnce({ data: null, error: { code: 'PGRST202', message: 'Could not find the function public.challenge_counts' } });
  await expect(fetchChallengeCounts('r1', 'actor-a')).rejects.toThrow(NOT_SWITCHED_ON);
  mockRpc.mockResolvedValueOnce({ data: null, error: { code: 'P0001', message: "You've sent 5 invites today. Try again tomorrow." } });
  await expect(inviteFriendToChallenge('r1', 'p2', 'actor-a')).rejects.toThrow('5 invites today');
});

it('parses counts: hidden counts stay null, unknown presets and reasons are dropped', () => {
  const shown = parseChallengeCounts({ enabled: true, eligible: true, visible: true, counts: { accepted: 24, love_it: null, im_in: '7', did_it: 5 }, total: 36, mine: 'accepted', can_respond: true, badge_earned: true });
  expect(shown.counts).toEqual({ accepted: 24, love_it: null, im_in: 7, did_it: 5 });
  expect(shown).toMatchObject({ total: 36, mine: 'accepted', canRespond: true, badgeEarned: true, reason: null });
  const minor = parseChallengeCounts({ enabled: true, eligible: true, visible: false, counts: null, total: null, mine: 'you rock' });
  expect(minor).toMatchObject({ visible: false, counts: null, total: null, mine: null });
  expect(parseChallengeCounts({ enabled: true, eligible: false, reason: 'vault' }).reason).toBe('vault');
  expect(parseChallengeCounts({ reason: 'made_up' }).reason).toBeNull();
  expect(parseChallengeCounts(null)).toMatchObject({ enabled: false, eligible: false, counts: null });
});

it('parses invites, status and the admin rows; the invite line follows the design wording', () => {
  const [invite] = parseChallengeInvites([{ id: 'n1', reel_id: 'r1', sender_id: 's1', sender_name: 'Mele', athlete_name: 'Sione', created_at: '2026-10-16T00:00:00Z' }, 'junk']);
  expect(challengeInviteText(invite)).toBe("Mele invited you to try Sione's workout");
  expect(CHALLENGE_PRESET_LABEL.did_it).toBe('Did it! 💪');
  expect(CHALLENGE_LIMITS).toMatchObject({ minShown: 5, responsesPerDay: 50, invitesPerDay: 5 });
  const status = parseChallengeStatus({ enabled: true, is_athlete: true, allow_challenges: false, allow_default: false, muted_all: true,
    muted_senders: [{ profile_id: 'p2', name: 'Lani' }], badges: [{ badge: 'challenge_finisher', earned_at: '2026-10-16' }, { badge: 'other' }] });
  expect(status).toMatchObject({ isAthlete: true, allowChallenges: false, mutedAll: true, mutedSenders: [{ profileId: 'p2', name: 'Lani' }] });
  expect(status.badges).toHaveLength(1);
  const admin = parseAdminChallengeStatus({ switched_on: false, live: false, missing: ['MINOR-01 age bands', 3], totals: { responses: '12', invites_7d: 4 } });
  expect(admin.missing).toEqual(['MINOR-01 age bands']);
  expect(admin.totals).toMatchObject({ responses: 12, invites7d: 4, badges: 0 });
  const [post] = parseAdminChallengePosts([{ reel_id: 'r1', title: ' ', athlete_name: 'Sione', eligible: false, reason: 'athlete_off', accepted: 3, did_it: '2' }]);
  expect(post).toMatchObject({ title: 'Untitled workout', eligible: false, reason: 'athlete_off', counts: { accepted: 3, love_it: 0, im_in: 0, did_it: 2 } });
  const [sender] = parseAdminChallengeSenders([{ sender_id: 's1', sender_username: 'spammy', sent: 9, recipient_ids: ['a', 2, 'b'], hold: 'ban' }]);
  expect(sender).toMatchObject({ username: 'spammy', sent: 9, recipientIds: ['a', 'b'], hold: null });
});

it('the guardian summary reads the challenge invite count, and the setting change reads as a sentence', () => {
  expect(parseSupervision({ summary: { challenge_invites_7d: 2 } }).summary.challengeInvites7d).toBe(2);
  expect(parseSupervision({ summary: {} }).summary.challengeInvites7d).toBe(0);
  expect(describeEvent({ kind: 'settings_changed', detail: { keys: ['allow_challenges'], allow_challenges: true }, at: '', byTeen: true }))
    .toBe('Changed: workout challenges on their posts.');
});

// Independent CHAL-DATA-I1 regression: transport success does not establish a usable report or committed action.
it.each([null, {}, {switched_on:false,live:false,missing:[],totals:{responses:'unknown'}}])('rejects unavailable/malformed admin status instead of healthy zero data: %p',async(data)=>{
 mockRpc.mockResolvedValueOnce({data,error:null});await expect(fetchAdminChallengeStatus('actor-a')).rejects.toThrow(/unavailable data/i);
});
it('rejects null list, retention, erasure and own export rather than acknowledging success',async()=>{
 for(const work of [()=>fetchAdminChallengePosts(30,'actor-a'),()=>fetchAdminChallengeSenders(7,'actor-a'),()=>adminChallengeRetention('actor-a'),()=>adminChallengeErase('p9','Request deletion','actor-a'),()=>exportMyChallengeData('actor-a'),()=>adminHoldChallengeSender('p9','suspend','Reported abuse','actor-a')]){
 mockRpc.mockResolvedValueOnce({data:null,error:null});await expect(work()).rejects.toThrow(/unavailable data/i);
 }
});
it('rejects malformed participant status/counts/inbox and unconfirmed invite acknowledgments',async()=>{
 for(const work of [()=>fetchMyChallengeStatus('actor-a'),()=>fetchChallengeCounts('r1','actor-a'),()=>fetchChallengeInbox(30,'actor-a'),()=>inviteFriendToChallenge('r1','p2','actor-a')]){
 mockRpc.mockResolvedValueOnce({data:{},error:null});await expect(work()).rejects.toThrow(/unavailable data/i);
 }
});

it('loads only bounded actor-bound accepted friend choices and rejects unavailable rows',async()=>{
 mockRpc.mockResolvedValueOnce({data:[{profile_id:'friend-1',name:'Mele'}],error:null});
 await expect(fetchChallengeFriends(50,'actor-a')).resolves.toEqual([{profileId:'friend-1',name:'Mele'}]);
 expect(mockRpc).toHaveBeenLastCalledWith('challenge_friends',{expected_actor_id:'actor-a',max_rows:50});
 for(const data of [null,{},[{profile_id:'',name:'Mele'}]]){mockRpc.mockResolvedValueOnce({data,error:null});await expect(fetchChallengeFriends(50,'actor-a')).rejects.toThrow(/unavailable data/i);}
});

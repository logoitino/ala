/** Real Supabase transport with synthetic session/HTTP/storage boundaries. */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '@/lib/supabase';
import { createOfflineActorClient, isOfflineActorChanged, type OfflineActorClient, type OfflineActor } from '@/lib/offlineActor';
import { claimOperatorGame, updateGameScore, updateOperatorQuarter, insertOperatorEvent, insertScorerPlayEvent, patchScorerGame, saveOperatorCheckIn, fetchOperatorGames, updateOperatorScore, persistOperatorClock, insertOperatorCallout } from '@/lib/operator';
jest.mock('@/lib/supabase', () => ({ isSupabaseConfigured: true, supabase: require('@supabase/supabase-js').createClient('https://operator-test.invalid','public-test-key',{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}}), nextRealtimeTopic:(p:string)=>p }));
const A='11111111-1111-4111-8111-111111111111'; const game={id:'game-A',home_score:0,away_score:0} as any; const player={id:'player-A',name:'Synthetic Player',jersey_number:3} as any;
const oldFetch=globalThis.fetch; const oldUrl=process.env.EXPO_PUBLIC_SUPABASE_URL;const oldKey=process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
let live:boolean;let actor:OfflineActor;let http:jest.Mock<ReturnType<typeof fetch>,Parameters<typeof fetch>>;
const session=(token='synthetic-A')=>({data:{session:{user:{id:A},access_token:token}},error:null});
const response=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json'}});
beforeEach(async()=>{await AsyncStorage.clear();live=true;actor={userId:A,isCurrent:()=>live};process.env.EXPO_PUBLIC_SUPABASE_URL='https://operator-test.invalid';process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY='public-test-key';jest.spyOn(supabase.auth,'getSession').mockResolvedValue(session() as never);http=jest.fn<ReturnType<typeof fetch>,Parameters<typeof fetch>>(async()=>response({...game,id:'game-A',home_score:1}));globalThis.fetch=http});
afterEach(()=>{jest.restoreAllMocks();globalThis.fetch=oldFetch;if(oldUrl===undefined)delete process.env.EXPO_PUBLIC_SUPABASE_URL;else process.env.EXPO_PUBLIC_SUPABASE_URL=oldUrl;if(oldKey===undefined)delete process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;else process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY=oldKey});
it.each([
 ['claim',(c:OfflineActorClient)=>claimOperatorGame(game.id,'profile-A',c,actor)],
 ['score',(c:OfflineActorClient)=>updateGameScore({game,homeDelta:1},c)],
 ['quarter',(c:OfflineActorClient)=>updateOperatorQuarter(game.id,'Q2',c)],
 ['tagged event',(c:OfflineActorClient)=>insertOperatorEvent({gameId:game.id,player,action:{id:'goal',label:'Goal',eventType:'Goal',points:1},teamName:'Synthetic Team'},c)],
 ['scorer event',(c:OfflineActorClient)=>insertScorerPlayEvent('Goal',player,game.id,c)],
 ['scorer patch',(c:OfflineActorClient)=>patchScorerGame(game.id,{home_score:1},c)],
 ['check-in',(c:OfflineActorClient)=>saveOperatorCheckIn(40.12345,-111.98765,c)],
] as const)('%s uses captured A even after global token becomes B',async(_label,run)=>{const c=await createOfflineActorClient(actor);jest.mocked(supabase.auth.getSession).mockResolvedValue(session('synthetic-B') as never);await run(c);expect(http.mock.calls.map(([,init])=>new Headers(init?.headers).get('Authorization'))).toEqual(['Bearer synthetic-A'])});
it('denied configured claim never creates the local dev marker',async()=>{const c=await createOfflineActorClient(actor);http.mockResolvedValueOnce(response({code:'42501',message:'Synthetic claim denied'},403));await expect(claimOperatorGame(game.id,'profile-A',c,actor)).rejects.toThrow('Synthetic claim denied');expect(await AsyncStorage.getItem('tapuai.operatorClaim.game-A')).toBeNull()});
it('an issued outgoing claim may complete but cannot create a delayed local marker',async()=>{const c=await createOfflineActorClient(actor);http.mockImplementationOnce(async()=>{live=false;return response({})});const error=await claimOperatorGame(game.id,'profile-A',c,actor).catch(e=>e);expect(isOfflineActorChanged(error)).toBe(true);expect(await AsyncStorage.getItem('tapuai.operatorClaim.game-A')).toBeNull()});
it.each(['42501','P0001'])('a %s score refusal cannot fall back to a direct write',async(code)=>{const c=await createOfflineActorClient(actor);http.mockResolvedValueOnce(response({code,message:'Synthetic score refused'},403));await expect(updateGameScore({game,homeDelta:1},c)).rejects.toThrow('Synthetic score refused');expect(http).toHaveBeenCalledTimes(1)});
it('missing score RPC fallback remains captured A and stops on actor loss',async()=>{const c=await createOfflineActorClient(actor);http.mockImplementationOnce(async()=>{live=false;return response({code:'PGRST202',message:'Could not find function'},404)});const error=await updateGameScore({game,homeDelta:1},c).catch(e=>e);expect(isOfflineActorChanged(error)).toBe(true);expect(http).toHaveBeenCalledTimes(1)});

it.each([
  ['score timestamp', (c: OfflineActorClient) => updateOperatorScore({ game, side: 'home', points: 1 }, c), 'updated_at'],
  ['clock flag', (c: OfflineActorClient) => persistOperatorClock(game, { running: true }, c), 'is_clock_running'],
  ['callout game', (c: OfflineActorClient) => insertOperatorCallout({ gameId: game.id, callout: { id: 'goal', label: 'Goal', eventType: 'Goal', emoji: 'ball' }, teamName: 'Synthetic Team' }, c), 'game_id'],
] as const)('%s denial mentioning a field cannot trigger schema fallback', async (_label, run, field) => {
  const c = await createOfflineActorClient(actor);
  http.mockResolvedValueOnce(response({ code: '42501', message: `Synthetic ${field} denied` }, 403));
  await expect(run(c)).rejects.toThrow(`Synthetic ${field} denied`);
  expect(http).toHaveBeenCalledTimes(1);
});
it('live game read denial is returned instead of querying a broader list', async () => {
  const c = await createOfflineActorClient(actor);
  http.mockResolvedValueOnce(response({ code: '42501', message: 'Synthetic list denied' }, 403));
  const result = await fetchOperatorGames(c);
  expect(result).toEqual({ games: [], error: 'Synthetic list denied' }); expect(http).toHaveBeenCalledTimes(1);
});

it('configured claim without a profile refuses the local marker', async () => {
  const c = await createOfflineActorClient(actor);
  await expect(claimOperatorGame(game.id, null, c, actor)).rejects.toThrow();
  expect(http).not.toHaveBeenCalled(); expect(await AsyncStorage.getItem('tapuai.operatorClaim.game-A')).toBeNull();
});
it('configured claim with no confirmed game row refuses the local marker', async () => {
  const c = await createOfflineActorClient(actor); http.mockResolvedValueOnce(response([]));
  await expect(claimOperatorGame(game.id, 'profile-A', c, actor)).rejects.toThrow();
  expect(await AsyncStorage.getItem('tapuai.operatorClaim.game-A')).toBeNull();
});

/** FUN-01 visible participant journeys use the real hook/SDK and safe synthetic external transport. */
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { FanZoneScreen } from '@/components/FanZone/FanZoneScreen';
import FanZoneRoute from '../../../../../app/fan-zone';
import { fanSnapshotFixture, FUN_IDS } from '@/lib/__tests__/fanZoneFixtures';
import type { FanZoneSnapshot } from '@shared/fanZone';
let mockAuth={user:{id:'auth-owner'},profile:{id:FUN_IDS.owner,user_id:'auth-owner',birth_year:1980,birth_month:1},isGuest:false,loading:false,role:'parent'};
const mockRpc=jest.fn(),mockBack=jest.fn(),mockReplace=jest.fn(),mockPush=jest.fn();
let mockCanBack=true,bank:FanZoneSnapshot;
let mockParams:{campaign?:string|string[];section?:string|string[]}={};
jest.mock('@/context/AuthContext',()=>({useAuth:()=>mockAuth}));
jest.mock('@/context/SoftWallContext',()=>({useSoftWall:()=>({requireAuth:jest.fn()})}));
jest.mock('@/components/ScreenShell',()=>({ScreenShell:({children}:{children:React.ReactNode})=>children}));
jest.mock('@/components/Legal/LegalModal',()=>({LegalModal:()=>null}));
jest.mock('expo-router',()=>({useRouter:()=>({back:mockBack,canGoBack:()=>mockCanBack,replace:mockReplace,push:mockPush}),useFocusEffect:jest.fn(),useLocalSearchParams:()=>mockParams}));
jest.mock('expo-crypto',()=>({randomUUID:()=> '90000000-0000-0000-0000-000000000001'}));
jest.mock('expo-video',()=>({useVideoPlayer:()=>({play:jest.fn(),pause:jest.fn(),addListener:()=>({remove:jest.fn()})}),VideoView:()=>null}));
jest.mock('expo-image-picker',()=>({launchImageLibraryAsync:jest.fn(async()=>({canceled:true,assets:[]}))}));
jest.mock('@/lib/supabase',()=>({isSupabaseConfigured:true,supabase:{rpc:(fn:string,args:unknown)=>mockRpc(fn,args),storage:{from:()=>({upload:jest.fn()})}}}));
jest.mock('@/services/MediaUploadService',()=>({compressHighlight:jest.fn(),bytesFromUri:jest.fn()}));
jest.mock('@/lib/fanZoneMedia',()=>({verifyFanZoneUpload:jest.fn(),removeFanZoneMedia:jest.fn()}));
jest.mock('../FanZoneVideo',()=>({FanZoneVideo:({reviewKey,onReady,onOpen,open}:{reviewKey:string,onReady:(key:string,ready:boolean)=>void,onOpen:()=>void,open:boolean})=>{
 const {Text,Pressable}=require('react-native');return <><Pressable accessibilityLabel="Open exact video" onPress={onOpen}><Text>Open exact video</Text></Pressable>{open?<Pressable accessibilityLabel="Video frame ready" onPress={()=>onReady(reviewKey,true)}><Text>Video frame ready</Text></Pressable>:null}</>;
}}),{virtual:true});
beforeEach(()=>{jest.clearAllMocks();mockCanBack=true;mockParams={};mockAuth={user:{id:'auth-owner'},profile:{id:FUN_IDS.owner,user_id:'auth-owner',birth_year:1980,birth_month:1},isGuest:false,loading:false,role:'parent'};bank=fanSnapshotFixture();mockRpc.mockImplementation(async(fn:string,args:Record<string,unknown>)=>{
 if(fn==='fun_permission')return{data:{ok:true,entry:bank.entry??bank.guardian_queue[0]},error:null};
 if(fn==='fun_entry'){bank.entry={...bank.entry!,status:args.p_action==='withdraw'?'withdrawn':'submitted'};return{data:{ok:true,entry:bank.entry},error:null};}
 if(fn==='fun_reflection'){
  if(args.p_action==='delete'){bank={...bank,reflections:[]};return{data:{ok:true,deleted_id:args.p_id},error:null};}
  const reflection={id:FUN_IDS.audit,campaign_id:FUN_IDS.campaign,idea:args.p_idea as 'encourage',created_at:'2026-10-14T00:00:00Z'};bank={...bank,reflections:[reflection]};return{data:{ok:true,reflection},error:null};
 }
 return{data:bank,error:null};
 });});
const open=async()=>{await render(<FanZoneScreen/>);await screen.findByText('Family cheer');};
it('provides prior Back and the actual role Home outside a fan-only gate',async()=>{
 await open();await fireEvent.press(screen.getByLabelText('Back'));expect(mockBack).toHaveBeenCalled();await fireEvent.press(screen.getByLabelText('Account Home'));expect(mockReplace).toHaveBeenCalledWith('/parent');
});
it('uses role Home when no previous route exists',async()=>{mockCanBack=false;await open();await fireEvent.press(screen.getByLabelText('Back'));expect(mockReplace).toHaveBeenCalledWith('/parent');});
it('shows three voluntary paths, published deadlines and private receipt versus public candidacy',async()=>{
 await open();expect(screen.getByLabelText('Join the fun')).toBeTruthy();expect(screen.getByLabelText('Meet an athlete')).toBeTruthy();expect(screen.getByLabelText('Serve together')).toBeTruthy();
 expect(screen.getByText(/Voting.*2026-10-16/)).toBeTruthy();expect(screen.getByText(/Private entry.*accepted/i)).toBeTruthy();expect(screen.getByText(/Free ballots.*donations.*votes/i)).toBeTruthy();
});
it('allows an unlisted guardian private review and requires real readiness plus exact copy review before grant',async()=>{
 bank={...bank,entry:null,candidates:[],can_participate:false,guardian_queue:[bank.entry!]};await open();
 expect(screen.queryByLabelText('Upload private entry')).toBeNull();expect(screen.getByLabelText('Grant exact revision permission')).toBeDisabled();
 await fireEvent.press(screen.getByLabelText('I reviewed this caption and exact permission scope'));expect(screen.getByLabelText('Grant exact revision permission')).toBeDisabled();
 await fireEvent.press(screen.getByLabelText('Open exact video'));await fireEvent.press(screen.getByLabelText('Video frame ready'));await fireEvent.press(screen.getByLabelText('Grant exact revision permission'));
 await waitFor(()=>expect(mockRpc).toHaveBeenCalledWith('fun_permission',expect.objectContaining({p_entry_id:FUN_IDS.entry,p_revision:2,p_action:'grant',p_expected_scope:bank.guardian_queue[0].consent_scope})));
});
it('never grants from unavailable video or after the authoritative revision changes',async()=>{
 bank={...bank,entry:null,candidates:[],can_participate:false,guardian_queue:[bank.entry!]};await open();await fireEvent.press(screen.getByLabelText('I reviewed this caption and exact permission scope'));expect(screen.getByLabelText('Grant exact revision permission')).toBeDisabled();
 await fireEvent.press(screen.getByLabelText('Open exact video'));await fireEvent.press(screen.getByLabelText('Video frame ready'));
 bank={...bank,guardian_queue:bank.guardian_queue.map(e=>({...e,revision:3,consent_scope:{...e.consent_scope,revision:3}}))};await fireEvent.press(screen.getByLabelText('Refresh Fan Zone'));await waitFor(()=>expect(screen.getByLabelText('Grant exact revision permission')).toBeDisabled());
});
it('withdraws privately without claiming object deletion and keeps Help & Safety contact selectable',async()=>{
 await open();await fireEvent.press(screen.getByLabelText('Withdraw my entry'));expect(await screen.findByText('Entry withdrawn. Media removal is a separate tracked request.')).toBeTruthy();expect(screen.getByText('pilot@example.invalid').props.selectable).toBe(true);expect(screen.getByLabelText('Continue tracked removal')).toBeTruthy();
});
it('shows guest concern/status forms without campaign, candidate or media fallback',async()=>{
 mockAuth.isGuest=true;await render(<FanZoneScreen/>);expect(screen.getByLabelText('Concern entry ID')).toBeTruthy();expect(screen.getByLabelText('Receipt ID')).toBeTruthy();expect(screen.queryByText('Family cheer')).toBeNull();expect(screen.queryByLabelText('Open exact video')).toBeNull();expect(mockRpc).not.toHaveBeenCalled();
 expect(screen.getByText(/No campaign support contact is available/)).toBeTruthy();
});
it('shows unavailable source honestly and never displays stale private content',async()=>{
 mockRpc.mockResolvedValue({data:null,error:{message:'token=private-caption'}});await render(<FanZoneScreen/>);expect(await screen.findByText('Fan Zone is unavailable. Refresh or contact Support.')).toBeTruthy();expect(screen.queryByText('Family cheer')).toBeNull();expect(screen.queryByText(/token=/)).toBeNull();
});
it('offers optional private preset service and no public reward or free-text proof',async()=>{
 await open();await fireEvent.press(screen.getByLabelText('Serve together'));await fireEvent.press(screen.getByLabelText('Encourage someone'));
 expect(await screen.findByText(/Private reflection received/)).toBeTruthy();expect(await screen.findByText(/Private idea: encourage/)).toBeTruthy();expect(screen.queryByLabelText('Service proof')).toBeNull();await fireEvent.press(screen.getByLabelText('Delete private reflection'));expect(await screen.findByText('Private reflection deleted.')).toBeTruthy();expect(screen.queryByText(/Private idea: encourage/)).toBeNull();
});
it('does not substitute an athlete when curated story is unavailable',async()=>{await open();await fireEvent.press(screen.getByLabelText('Meet an athlete'));expect(screen.getByText(/This curated story is unavailable/)).toBeTruthy();expect(screen.queryByLabelText('Athlete profile & Donate')).toBeNull();});
it('keeps an uncertain ballot choice disabled and shows the authoritative ballot after retry',async()=>{
 bank.entry=null;await open();let writes=0;mockRpc.mockImplementation(async(fn:string,args:Record<string,unknown>)=>{
  if(fn!=='fun_vote')return{data:bank,error:null};if(++writes===1)throw new Error('lost reply');bank={...bank,ballot:{id:FUN_IDS.ballot,campaign_id:FUN_IDS.campaign,entry_id:FUN_IDS.audit,version:2,invalidated:false}};
  return{data:{ok:true,request_id:args.p_request_id,ballot:{...bank.ballot,entry_id:FUN_IDS.entry,version:1}},error:null};
 });
 await fireEvent.press(screen.getByLabelText('Vote for Family Fan'));expect(await screen.findByText(/Ballot confirmation is pending/)).toBeTruthy();expect(screen.getByLabelText('Vote for Family Fan')).toBeDisabled();
 await fireEvent.press(screen.getByLabelText('Retry original ballot'));expect(await screen.findByText('Current ballot: candidate unavailable · version 2')).toBeTruthy();expect(screen.queryByLabelText('Retry original ballot')).toBeNull();const votes=mockRpc.mock.calls.filter(([fn])=>fn==='fun_vote');expect(votes[0][1]).toEqual(votes[1][1]);
});
it('provides a guest secret status receipt without unlocking campaign content',async()=>{
 mockAuth.isGuest=true;const receipt={id:FUN_IDS.case,entry_id:FUN_IDS.entry,revision:2,kind:'report',status:'open',created_at:'2026-10-14T00:00:00Z',expires_at:'2026-11-13T00:00:00Z'};
 mockRpc.mockResolvedValue({data:{ok:true,case:receipt},error:null});await render(<FanZoneScreen/>);await fireEvent.changeText(screen.getByLabelText('Concern entry ID'),FUN_IDS.entry);await fireEvent.changeText(screen.getByLabelText('Concern details'),'Please review this video');await fireEvent.press(screen.getByLabelText('Send concern'));
 expect(await screen.findByText(/Secret 90000000/)).toBeTruthy();expect(screen.queryByText('Family cheer')).toBeNull();await fireEvent.changeText(screen.getByLabelText('Receipt ID'),FUN_IDS.case);await fireEvent.changeText(screen.getByLabelText('Private receipt secret'),'90000000-0000-0000-0000-000000000001');await fireEvent.press(screen.getByLabelText('Check concern status'));
 await waitFor(()=>expect(mockRpc).toHaveBeenCalledWith('fun_case_status',{p_case_id:FUN_IDS.case,p_secret:'90000000-0000-0000-0000-000000000001'}));
});
it('directs a quota-refused concern to the actual displayed contact without claiming intake succeeded',async()=>{
 await open();mockRpc.mockResolvedValue({data:null,error:{message:'FUN_CASE_RATE_LIMIT'}});await fireEvent.changeText(screen.getByLabelText('Concern entry ID'),FUN_IDS.entry);await fireEvent.changeText(screen.getByLabelText('Concern details'),'Please review this video');await fireEvent.press(screen.getByLabelText('Send concern'));
 expect(await screen.findByText(/concern queue limit was reached/)).toBeTruthy();expect(screen.getByText('pilot@example.invalid')).toBeTruthy();expect(screen.queryByText(/Request received/)).toBeNull();
});
it('passes only validated canonical campaign context through the root route without automatic permission',async()=>{
 mockParams={campaign:FUN_IDS.campaign,section:'permissions'};await render(<FanZoneRoute/>);await screen.findByText('Family cheer');expect(mockRpc).toHaveBeenCalledWith('fun_snapshot',{p_campaign_id:FUN_IDS.campaign});expect(mockRpc.mock.calls.some(([fn])=>fn!=='fun_snapshot')).toBe(false);
});
it('ignores an array campaign query rather than binding an arbitrary identifier',async()=>{
 mockParams={campaign:[FUN_IDS.campaign,FUN_IDS.owner]};await render(<FanZoneRoute/>);await screen.findByText('Family cheer');expect(mockRpc).toHaveBeenCalledWith('fun_snapshot',{p_campaign_id:null});
});
it('keeps the exact ballot retry available when a confirmed write is followed by an unavailable current read',async()=>{
 bank.entry=null;await open();mockRpc.mockImplementation(async(fn:string,args:Record<string,unknown>)=>fn==='fun_vote'?{data:{ok:true,request_id:args.p_request_id,ballot:{id:FUN_IDS.ballot,campaign_id:FUN_IDS.campaign,entry_id:FUN_IDS.entry,version:1,invalidated:false}},error:null}:{data:null,error:{message:'FUN_CAMPAIGN_UNAVAILABLE'}});
 await fireEvent.press(screen.getByLabelText('Vote for Family Fan'));await screen.findByText('Fan Zone could not complete this action. Refresh or contact Support.');expect(screen.getByLabelText('Retry original ballot')).toBeTruthy();expect(screen.queryByText(/Current ballot:/)).toBeNull();
});

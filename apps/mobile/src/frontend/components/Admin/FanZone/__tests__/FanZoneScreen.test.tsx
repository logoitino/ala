/** FUN-01 visible admin tests exercise the actual SDK/RPC transport, privacy gate and honest removal outcomes. */
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { FanZoneScreen } from '@/components/Admin/FanZone/FanZoneScreen';
import { fanAdminFixture, fanRemovalFixture, FUN_IDS } from '@/lib/__tests__/fanZoneFixtures';
import { loadFanZoneVideo, removeFanZoneMedia } from '@/lib/fanZoneMedia';
import type { FanZoneAdminSnapshot } from '@shared/fanZone';

let mockAuth = { isAdmin: true, loading: false };
let mockBank: FanZoneAdminSnapshot;
const mockTransport = jest.fn();
const mockPush = jest.fn();
const mockClient = { rpc(fn: string, args: unknown) { return mockTransport(fn,args); } };
jest.mock('@/lib/supabase', () => ({ isSupabaseConfigured: true, get supabase() { return mockClient; } }));
jest.mock('@/context/AuthContext', () => ({ useAuth: () => mockAuth }));
jest.mock('@/context/SoftWallContext', () => ({ useSoftWall: () => ({ requireAuth: jest.fn() }) }));
jest.mock('@/context/AdminLensContext', () => ({ AdminLensProvider: ({ children }: { children: React.ReactNode }) => children, useAdminLens: () => ({ lens: 'all', setLens: jest.fn() }) }));
jest.mock('@/context/AppRuntimeContext', () => ({ useAppRuntime: () => ({ dirty: false, live: { theme: {} } }) }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }) }));
jest.mock('expo-router', () => ({ Link: ({ children }: { children: React.ReactNode }) => children, usePathname: () => '/admin/fan-zone', useRouter: () => ({ push: mockPush }), useFocusEffect: jest.fn() }));
jest.mock('expo-crypto', () => ({ randomUUID: () => '90000000-0000-0000-0000-000000000001' }));
jest.mock('expo-video', () => ({ useVideoPlayer: () => ({ play: jest.fn(), pause: jest.fn(), addListener: () => ({ remove: jest.fn() }) }), VideoView: () => null }));
jest.mock('@/lib/fanZoneMedia', () => ({ loadFanZoneVideo: jest.fn(), removeFanZoneMedia: jest.fn() }));
const api = jest.mocked(removeFanZoneMedia);
beforeEach(() => {
 jest.clearAllMocks(); mockAuth = { isAdmin: true, loading: false }; mockBank = fanAdminFixture();
 mockTransport.mockImplementation(async (fn: string, args: Record<string, unknown>) => {
  if(fn==='fun_admin_snapshot')return { data: mockBank, error: null };
  if(fn==='fun_admin_campaign') { mockBank.campaign!.status = args.p_action==='pause'?'paused':args.p_action==='close'?'closed':args.p_action==='open'?'open':args.p_action==='finalize'||args.p_action==='recount'?'finalized':mockBank.campaign!.status; return { data: { ok: true, campaign: mockBank.campaign }, error: null }; }
  if(fn==='fun_admin_entry') { const target = { accept:'accepted',changes:'changes',reject:'rejected',suspend:'suspended' }[String(args.p_action)]; mockBank.entries[0].status=target as typeof mockBank.entries[0]['status']; mockBank.counts.entry_statuses={ [String(target)]:1 }; return { data:{ ok:true,entry:mockBank.entries[0] }, error:null }; }
  if(fn==='fun_admin_ballot')return { data:{ ok:true,ballot:{ ...mockBank.ballots[0],invalidated_at:'2026-10-14T07:00:00Z',invalid_reason:args.p_reason } },error:null };
  if(fn==='fun_admin_case')return { data:{ ok:true,case:{ id:FUN_IDS.case,entry_id:FUN_IDS.entry,revision:2,kind:'report',status:args.p_action==='resolve'?'resolved':'escalated',created_at:'2026-10-14T06:00:00Z',expires_at:'2026-11-13T06:00:00Z' } },error:null };
  if(fn==='fun_case'){ mockBank.cases[0].kind='deletion'; return { data:{ ok:true,case:{ id:FUN_IDS.case,entry_id:FUN_IDS.entry,revision:2,kind:'deletion',status:'open',created_at:'2026-10-14T06:00:00Z',expires_at:'2026-11-13T06:00:00Z' } },error:null }; }
  return { data:null,error:{ message:'Unexpected RPC' } };
 });
 api.mockResolvedValue(fanRemovalFixture(2,true));
});
const openDesk = async () => { await render(<FanZoneScreen />); await screen.findByText('Selected campaign data'); };
const reason = async () => fireEvent.changeText(screen.getByLabelText('Review or action reason'),'Verified exact testing evidence.');
const selectEntry = async () => fireEvent.press(screen.getByLabelText('Review entry Family Fan'));
it('does not mount or fetch private desk for a non-admin', async () => { mockAuth.isAdmin=false; await render(<FanZoneScreen />); expect(screen.getByText('Access Restricted')).toBeTruthy(); expect(mockTransport).not.toHaveBeenCalled(); });
it('shows unavailable without healthy zero counts or private raw errors', async () => {
 mockTransport.mockResolvedValue({ data:null,error:{ message:'Private caption token=secret' } }); await render(<FanZoneScreen />);
 expect(await screen.findByText('Fan Zone is unavailable. Refresh or contact Support.')).toBeTruthy(); expect(screen.queryByText('Selected campaign data')).toBeNull(); expect(screen.queryByText(/token=secret/)).toBeNull();
});
it('renders complete Data rows, explicit populations, exact consent scope and all revisions', async () => {
 await openDesk(); await fireEvent.press(screen.getByLabelText('Data'));
 expect(screen.getByText(/1 of 1 entries/)).toBeTruthy(); expect(screen.getByText(/1 of 1 ballots/)).toBeTruthy();
 expect(screen.getAllByText(/Our family cheer/).length).toBeGreaterThan(0); expect(screen.getByText(/approved_pilot_accounts/)).toBeTruthy(); expect(screen.getByText(new RegExp(FUN_IDS.grant))).toBeTruthy();
 expect(screen.getByText(/Please review the exact caption/)).toBeTruthy(); expect(screen.getByText(/revision 1.*present/i)).toBeTruthy();
});
it('pauses once with authoritative visible status, then refuses edits to opened rules', async () => {
 let finish: (reply: unknown)=>void = ()=>{};
 mockTransport.mockImplementation((fn:string)=>fn==='fun_admin_campaign'?new Promise(resolve=>{finish=resolve;}):Promise.resolve({ data:mockBank,error:null }));
 await openDesk(); await fireEvent.press(screen.getByLabelText('Pause campaign')); await fireEvent.press(screen.getByLabelText('Pause campaign'));
 expect(mockTransport.mock.calls.filter(([fn])=>fn==='fun_admin_campaign')).toHaveLength(1);
 expect(screen.getByLabelText('Pause campaign')).toBeDisabled(); mockBank.campaign!.status='paused'; finish({ data:{ok:true,campaign:mockBank.campaign},error:null });
 expect(await screen.findByText('Campaign paused. New entries and ballots are stopped.')).toBeTruthy(); expect(screen.getAllByText(/paused · testing only/).length).toBeGreaterThan(0); expect(screen.getByLabelText('Save campaign configuration')).toBeDisabled();
});
it('shows a safe failed campaign action and retains the authoritative source status', async () => {
 await openDesk(); mockTransport.mockImplementation(async(fn:string)=>fn==='fun_admin_campaign'?{ data:null,error:{ message:'FUN_STATE_INVALID' } }:{ data:mockBank,error:null });
 await fireEvent.press(screen.getByLabelText('Pause campaign')); expect(await screen.findByText('Fan Zone could not complete this action. Refresh or contact Support.')).toBeTruthy(); expect(screen.getAllByText(/open · testing only/).length).toBeGreaterThan(0);
});
it.each(['Accept entry','Request changes','Reject entry','Suspend entry'])('requires private selection/reason and produces visible %s feedback', async label => {
 mockBank.entries[0].status='submitted';mockBank.counts.entry_statuses={submitted:1};mockBank.ballots[0].valid=false;mockBank.counts.valid_ballots=0;
 await openDesk(); await selectEntry(); expect(screen.getByLabelText(label)).toBeDisabled(); await reason(); await fireEvent.press(screen.getByLabelText(label));
 await waitFor(()=>expect(mockTransport.mock.calls.some(([fn])=>fn==='fun_admin_entry')).toBe(true)); expect(await screen.findByText(/Entry review saved/)).toBeTruthy();
});
it('loads video only on explicit review and releases it when the desk unmounts', async () => {
 const release=jest.fn(); jest.mocked(loadFanZoneVideo).mockResolvedValue({source:{uri:'blob:private'},release}); const rendered=await render(<FanZoneScreen />); await screen.findByText('Selected campaign data'); await selectEntry(); expect(loadFanZoneVideo).not.toHaveBeenCalled();
 await fireEvent.press(screen.getByLabelText('Review private video')); await screen.findByLabelText('Close private video'); expect(loadFanZoneVideo).toHaveBeenCalledWith(FUN_IDS.entry,2,expect.anything()); await rendered.unmount(); expect(release).toHaveBeenCalledTimes(1);
});
it('requires proven invalidity before invalidation and shows recount feedback', async () => {
 await openDesk(); await fireEvent.press(screen.getByLabelText(`Review ballot ${FUN_IDS.ballot}`)); await reason(); expect(screen.getByLabelText('Invalidate proven ballot')).toBeDisabled();
 await fireEvent.press(screen.getByLabelText('Invalidity proven')); await fireEvent.press(screen.getByLabelText('Invalidate proven ballot')); expect(await screen.findByText(/Ballot invalidated.*recount/i)).toBeTruthy();
});
it.each(['Escalate case','Resolve case'])('records bounded reason and visible %s feedback', async label => {
 await openDesk(); await fireEvent.press(screen.getByLabelText(`Review case ${FUN_IDS.case}`)); await reason(); await fireEvent.press(screen.getByLabelText(label)); expect(await screen.findByText(/Case (escalated|resolved)/)).toBeTruthy();
});
it('pages 51 tied rows independently by exact timestamp and row ID without discarding complete data', async () => {
 mockBank.cases=Array.from({length:50},(_,i)=>({...fanAdminFixture().cases[0],id:`50000000-0000-0000-0000-${String(51-i).padStart(12,'0')}`}));
 mockBank.audit=Array.from({length:50},(_,i)=>({...fanAdminFixture().audit[0],id:`60000000-0000-0000-0000-${String(51-i).padStart(12,'0')}`}));
 const caseCursor=JSON.stringify({v:1,campaign:FUN_IDS.campaign,cases:{at:mockBank.cases[49].created_at,id:mockBank.cases[49].id}}),auditCursor=JSON.stringify({v:1,campaign:FUN_IDS.campaign,audit:{at:mockBank.audit[49].created_at,id:mockBank.audit[49].id}});
 mockBank.case_next_cursor=caseCursor; mockBank.audit_next_cursor=auditCursor; mockBank.counts.cases=51;mockBank.counts.open_cases=51; mockBank.counts.audit=51;
 await openDesk(); await fireEvent.press(screen.getByLabelText('Data'));
 const extra={...fanAdminFixture().cases[0],id:'50000000-0000-0000-0000-000000000001',details:'Earlier concern'};
 mockTransport.mockResolvedValueOnce({ data:{...mockBank,cases:[extra],case_next_cursor:null,audit:[],audit_next_cursor:null},error:null });
 await fireEvent.press(screen.getByLabelText('Load earlier cases')); expect(await screen.findByText(/Earlier concern/)).toBeTruthy();
 expect(mockTransport).toHaveBeenLastCalledWith('fun_admin_snapshot',{p_campaign_id:FUN_IDS.campaign,p_before:caseCursor});
 expect(screen.getByLabelText('Load earlier audit')).not.toBeDisabled(); expect(screen.getByText(/1 of 1 entries/)).toBeTruthy();
 const earlierAudit={...fanAdminFixture().audit[0],id:'60000000-0000-0000-0000-000000000001',action:'earlier_audit'};
 mockTransport.mockResolvedValueOnce({data:{...mockBank,cases:[],case_next_cursor:null,audit:[earlierAudit],audit_next_cursor:null},error:null});
 await fireEvent.press(screen.getByLabelText('Load earlier audit'));expect(await screen.findByText(/earlier_audit/)).toBeTruthy();
 expect(mockTransport).toHaveBeenLastCalledWith('fun_admin_snapshot',{p_campaign_id:FUN_IDS.campaign,p_before:auditCursor});
 expect(screen.getByText(/51 loaded of 51 cases.*51 loaded of 51 audit/)).toBeTruthy();
});
it('retains the reviewed scope on stale acceptance, refreshes and requires selection of the new revision',async()=>{
 mockBank.entries[0].status='submitted';mockBank.counts.entry_statuses={submitted:1};mockBank.ballots[0].valid=false;mockBank.counts.valid_ballots=0;
 await openDesk();await selectEntry();await reason();const oldScope={...mockBank.entries[0].consent_scope};
 const changed=fanAdminFixture();changed.entries[0].revision=3;changed.entries[0].digest='b'.repeat(64);changed.entries[0].consent_scope={...changed.entries[0].consent_scope,revision:3,digest:'b'.repeat(64)};changed.entries[0].status='submitted';changed.counts.entry_statuses={submitted:1};changed.ballots[0].valid=false;changed.counts.valid_ballots=0;
 mockTransport.mockImplementation(async(fn:string)=>fn==='fun_admin_entry'?{data:null,error:{message:'FUN_REVIEW_SCOPE_STALE'}}:{data:changed,error:null});
 await fireEvent.press(screen.getByLabelText('Accept entry'));
 expect(mockTransport).toHaveBeenCalledWith('fun_admin_entry',{p_entry_id:FUN_IDS.entry,p_action:'accept',p_reason:'Verified exact testing evidence.',p_expected_scope:oldScope});
 expect(await screen.findByText('This entry changed. Refresh and review the current revision before deciding.')).toBeTruthy();
 expect(await screen.findByText('Select an entry before reviewing private video or taking corrective action.')).toBeTruthy();expect(screen.queryByLabelText('Accept entry')).toBeNull();
 await selectEntry();expect(screen.getByLabelText('Accept entry')).toBeDisabled();
});
it('labels emergency suspension explicitly and sends null scope without accepting a replacement',async()=>{
 await openDesk();await selectEntry();await reason();await fireEvent.press(screen.getByLabelText('Emergency suspend current entry'));
 expect(mockTransport).toHaveBeenCalledWith('fun_admin_entry',{p_entry_id:FUN_IDS.entry,p_action:'suspend',p_reason:'Verified exact testing evidence.',p_expected_scope:null});
 expect(await screen.findByText('Current entry suspended for an emergency safety hold.')).toBeTruthy();
});
it('creates a staff tracked deletion then removes every present revision and requires completion', async () => {
 mockBank.entries[0].status='withdrawn'; mockBank.counts.entry_statuses={withdrawn:1}; await openDesk(); await selectEntry(); await reason();
 await fireEvent.press(screen.getByLabelText('Request tracked deletion')); expect(await screen.findByText(/Deletion requested.*not.*removed/i)).toBeTruthy();
 expect(mockTransport).toHaveBeenCalledWith('fun_case',expect.objectContaining({p_entry_id:FUN_IDS.entry,p_kind:'deletion',p_secret:'90000000-0000-0000-0000-000000000001'}));
 api.mockResolvedValueOnce(fanRemovalFixture(1,false)).mockResolvedValueOnce(fanRemovalFixture(2,true));
 await fireEvent.press(screen.getByLabelText('Remove all stored revisions')); expect(await screen.findByText('All stored revisions removed; server completion confirmed.')).toBeTruthy(); expect(api.mock.calls).toEqual([[FUN_IDS.entry,1],[FUN_IDS.entry,2]]);
});
it('retains honest partial cleanup when a later revision fails and never resolves deletion manually', async () => {
 mockBank.cases[0].kind='deletion'; await openDesk(); await selectEntry(); await fireEvent.press(screen.getByLabelText(`Review case ${FUN_IDS.case}`)); await reason(); expect(screen.getByLabelText('Resolve case')).toBeDisabled();
 api.mockResolvedValueOnce(fanRemovalFixture(1,false)).mockRejectedValueOnce(new Error('Private server path'));
 await fireEvent.press(screen.getByLabelText('Remove all stored revisions')); expect(await screen.findByText(/1 of 2 revisions removed.*completion not confirmed/i)).toBeTruthy(); expect(screen.queryByText('All stored revisions removed; server completion confirmed.')).toBeNull(); expect(screen.queryByText(/Private server path/)).toBeNull();
});
it('shows unconfirmed removal rather than success if no API receipt confirms all objects absent', async () => {
 mockBank.cases[0].kind='deletion'; await openDesk(); await selectEntry(); api.mockResolvedValueOnce(fanRemovalFixture(1,false)).mockResolvedValueOnce(fanRemovalFixture(2,false));
 await fireEvent.press(screen.getByLabelText('Remove all stored revisions')); expect(await screen.findByText(/2 of 2 revisions removed.*completion not confirmed/i)).toBeTruthy();
});
it('clears stale private rows and counts when a source refresh fails', async () => {
 await openDesk(); mockTransport.mockResolvedValue({data:null,error:{message:'Private refresh error'}});
 await fireEvent.press(screen.getByLabelText('Refresh source')); expect(await screen.findByText('Fan Zone is unavailable. Refresh or contact Support.')).toBeTruthy(); expect(screen.queryByText('Selected campaign data')).toBeNull();
});
it('creates a reviewed default-off testing draft with exact field binding', async () => {
 await openDesk(); await fireEvent.press(screen.getByLabelText('New campaign'));
 await fireEvent.changeText(screen.getByLabelText('Campaign title'),'Saturday family cheer'); await fireEvent.changeText(screen.getByLabelText('Campaign theme'),'Cheer together');
 expect(screen.getByLabelText('Open for approved testers')).toBeDisabled(); await fireEvent.press(screen.getByLabelText('Create testing draft'));
 expect(await screen.findByText(/Testing draft created/)).toBeTruthy(); expect(mockTransport).toHaveBeenCalledWith('fun_admin_campaign',expect.objectContaining({p_id:null,p_action:'create',p_payload:expect.objectContaining({title:'Saturday family cheer',theme:'Cheer together',period:'week',pilot_accounts:[],story_reel_id:null})}));
});
it('configures a draft and rejects malformed or empty opening audience', async () => {
 mockBank.campaign!.status='draft';mockBank.campaign!.opened_at=null;mockBank.campaign!.pilot_accounts=[];await openDesk();
 expect(screen.getByLabelText('Open for approved testers')).toBeDisabled(); await fireEvent.changeText(screen.getByLabelText('Approved tester profile IDs'),'not-a-profile');expect(screen.getByLabelText('Save campaign configuration')).toBeDisabled();
 await fireEvent.changeText(screen.getByLabelText('Approved tester profile IDs'),FUN_IDS.admin);await fireEvent.press(screen.getByLabelText('Save campaign configuration'));expect(await screen.findByText('Draft campaign configuration saved.')).toBeTruthy();
 expect(mockTransport).toHaveBeenCalledWith('fun_admin_campaign',expect.objectContaining({p_id:FUN_IDS.campaign,p_action:'configure',p_payload:expect.objectContaining({pilot_accounts:[FUN_IDS.admin]})}));
});
it.each([
 ['open','Open for approved testers','paused','Campaign opened for approved testers only.'],
 ['close','Close campaign','open','Campaign closed. No new entries or ballots.'],
 ['finalize','Finalize valid ballots','closed','Valid ballot results finalized under the published tie rules.'],
 ['recount','Recount valid ballots','finalized','Valid ballots recounted; corrected results saved.'],
] as const)('runs %s against the authoritative selected campaign with visible feedback', async(action,label,status,notice)=>{
 mockBank.campaign!.status=status;if(action==='finalize'||action==='recount'){mockBank.campaign!.entry_closes_at=new Date(Date.now()-120000).toISOString();mockBank.campaign!.vote_closes_at=new Date(Date.now()-60000).toISOString();}
 await openDesk();await fireEvent.press(screen.getByLabelText(label));expect(await screen.findByText(notice)).toBeTruthy();expect(mockTransport).toHaveBeenCalledWith('fun_admin_campaign',{p_id:FUN_IDS.campaign,p_action:action,p_payload:{}});
});
it('does not let the loaded case page withhold an existing server-authorized removal', async()=>{
 mockBank.cases=Array.from({length:50},(_,i)=>({...fanAdminFixture().cases[0],id:`50000000-0000-0000-0000-${String(i+1).padStart(12,'0')}`}));mockBank.counts.cases=51;mockBank.counts.open_cases=51;mockBank.case_next_cursor=JSON.stringify({v:1,campaign:FUN_IDS.campaign,cases:{at:mockBank.cases[49].created_at,id:mockBank.cases[49].id}});await openDesk();await selectEntry();
 // The deletion case exists on an older page. The media API still authorizes its exact tracked entry.
 api.mockResolvedValueOnce(fanRemovalFixture(1,false)).mockResolvedValueOnce(fanRemovalFixture(2,true));
 await fireEvent.press(screen.getByLabelText('Remove all stored revisions'));expect(await screen.findByText('All stored revisions removed; server completion confirmed.')).toBeTruthy();
});

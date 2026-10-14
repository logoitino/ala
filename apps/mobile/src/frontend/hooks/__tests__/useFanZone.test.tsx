/** FUN-01 real hook/SDK tests double auth, API and Storage only; no public table or offline queue. */
import { act, renderHook, waitFor } from '@testing-library/react-native';
import { useFanZone } from '@/hooks/useFanZone';
import { fanSnapshotFixture, FUN_IDS } from '@/lib/__fixtures__/fanZoneFixtures';
import type { FanZoneSnapshot } from '@shared/fanZone';
let mockAuth={user:{id:'auth-a'},profile:{id:FUN_IDS.owner,user_id:'auth-a'},isGuest:false,loading:false};
jest.mock('@/context/AuthContext',()=>({useAuth:()=>mockAuth}));
let mockNonce=0;
jest.mock('expo-crypto',()=>({randomUUID:()=>`90000000-0000-0000-0000-${String(++mockNonce).padStart(12,'0')}`}));
const mockRpc=jest.fn(),mockUpload=jest.fn();
jest.mock('@/lib/supabase',()=>({isSupabaseConfigured:true,supabase:{rpc:(fn:string,args:unknown)=>mockRpc(fn,args),storage:{from:(bucket:string)=>({upload:(path:string,body:unknown,options:unknown)=>mockUpload(bucket,path,body,options)})}}}));
jest.mock('@/services/MediaUploadService',()=>({compressHighlight:jest.fn(async(uri:string)=>uri),bytesFromUri:jest.fn(async()=>new ArrayBuffer(1024))}));
jest.mock('@/lib/fanZoneMedia',()=>({verifyFanZoneUpload:jest.fn(),removeFanZoneMedia:jest.fn()}));
import { compressHighlight } from '@/services/MediaUploadService';
import { verifyFanZoneUpload,removeFanZoneMedia } from '@/lib/fanZoneMedia';
const deferred=<T,>()=>{let resolve!:(v:T)=>void;const promise=new Promise<T>(done=>{resolve=done;});return{resolve,promise};};
let bank:FanZoneSnapshot;
beforeEach(()=>{jest.clearAllMocks();mockNonce=0;mockAuth={user:{id:'auth-a'},profile:{id:FUN_IDS.owner,user_id:'auth-a'},isGuest:false,loading:false};bank=fanSnapshotFixture();bank.entry=null;
 mockRpc.mockImplementation(async()=>({data:bank,error:null}));mockUpload.mockResolvedValue({error:null});});
const ready=async()=>{const view=await renderHook(()=>useFanZone(FUN_IDS.campaign));await waitFor(()=>expect(view.result.current.loading).toBe(false));return view;};
it.each(['auth','profile'])('ignores an old %s read and clears private state across identity changes',async kind=>{
 const old=deferred<unknown>();mockRpc.mockImplementationOnce(()=>old.promise);const view=await renderHook(()=>useFanZone());
 mockAuth=kind==='auth'?{...mockAuth,user:{id:'auth-b'},profile:{id:FUN_IDS.admin,user_id:'auth-b'}}:{...mockAuth,profile:{...mockAuth.profile,id:FUN_IDS.admin}};
 const next={...bank,candidates:[]};mockRpc.mockResolvedValue({data:next,error:null});await view.rerender({});await waitFor(()=>expect(view.result.current.snapshot).toEqual(next));
 await act(async()=>{old.resolve({data:fanSnapshotFixture(),error:null});await old.promise;});expect(view.result.current.snapshot?.entry).toBeNull();
});
it('requires matching canonical identity and never fetches a guest campaign',async()=>{
 mockAuth.profile.user_id='old-auth';const view=await renderHook(()=>useFanZone());expect(mockRpc).not.toHaveBeenCalled();expect(view.result.current.snapshot).toBeNull();
 mockAuth={...mockAuth,isGuest:true};await view.rerender({});expect(mockRpc).not.toHaveBeenCalled();
});
it('retains an uncertain ballot UUID/choice/version, rejects other choices and refetches another device current ballot',async()=>{
 const view=await ready();let writes=0;mockRpc.mockImplementation(async(fn:string,args:Record<string,unknown>)=>{
  if(fn!=='fun_vote')return{data:bank,error:null};if(++writes===1)throw new Error('lost private reply');
  const original={id:FUN_IDS.ballot,campaign_id:FUN_IDS.campaign,entry_id:FUN_IDS.entry,version:1,invalidated:false};bank={...bank,ballot:{...original,entry_id:FUN_IDS.audit,version:2}};
  return{data:{ok:true,request_id:args.p_request_id,ballot:original},error:null};
 });
 await act(async()=>{await view.result.current.vote(FUN_IDS.entry);await view.result.current.vote(FUN_IDS.audit);});
 expect(mockRpc.mock.calls.filter(([fn])=>fn==='fun_vote')).toHaveLength(1);expect(view.result.current.pendingBallot?.entryId).toBe(FUN_IDS.entry);
 await act(async()=>{await view.result.current.vote(FUN_IDS.entry);});const calls=mockRpc.mock.calls.filter(([fn])=>fn==='fun_vote');expect(calls[1][1]).toEqual(calls[0][1]);
 expect(view.result.current.snapshot?.ballot?.version).toBe(2);expect(view.result.current.snapshot?.ballot?.entry_id).toBe(FUN_IDS.audit);expect(view.result.current.pendingBallot).toBeNull();
});
it('never fabricates current ballot from a receipt when its authoritative read fails',async()=>{
 const view=await ready();mockRpc.mockImplementation(async(fn:string,args:Record<string,unknown>)=>fn==='fun_vote'?{data:{ok:true,request_id:args.p_request_id,ballot:{id:FUN_IDS.ballot,campaign_id:FUN_IDS.campaign,entry_id:FUN_IDS.entry,version:1,invalidated:false}},error:null}:{data:null,error:{message:'private read failure'}});
 await act(async()=>{await view.result.current.vote(FUN_IDS.entry);});expect(view.result.current.snapshot).toBeNull();expect(view.result.current.pendingBallot?.entryId).toBe(FUN_IDS.entry);expect(view.result.current.error).toMatch(/unavailable|confirm/i);
});
it('does not start a prior identity write follow-up read after auth changes',async()=>{
 const view=await ready();const old=deferred<unknown>();mockRpc.mockImplementation((fn:string)=>fn==='fun_vote'?old.promise:Promise.resolve({data:bank,error:null}));
 let write!:Promise<unknown>;await act(async()=>{write=view.result.current.vote(FUN_IDS.entry);});mockAuth={...mockAuth,user:{id:'auth-b'},profile:{id:FUN_IDS.admin,user_id:'auth-b'}};await view.rerender({});await waitFor(()=>expect(view.result.current.loading).toBe(false));const n=mockRpc.mock.calls.length;
 await act(async()=>{old.resolve({data:{ok:true,request_id:'90000000-0000-0000-0000-000000000001',ballot:{id:FUN_IDS.ballot,campaign_id:FUN_IDS.campaign,entry_id:FUN_IDS.entry,version:1,invalidated:false}},error:null});await write;});expect(mockRpc.mock.calls).toHaveLength(n);expect(view.result.current.pendingBallot).toBeNull();
});
it('reserves/edits private metadata, inserts without overwrite, verifies before returning the exact draft',async()=>{
 const view=await ready();const entry={...fanSnapshotFixture().entry!,status:'draft' as const,verified:false,digest:null,bytes:null,duration_ms:null,consent_scope:{...fanSnapshotFixture().entry!.consent_scope,digest:null}};
 const verified={...entry,verified:true,digest:'a'.repeat(64),bytes:1024,duration_ms:1000,consent_scope:{...entry.consent_scope,digest:'a'.repeat(64)}};
 mockRpc.mockImplementation(async(fn:string)=>fn==='fun_entry'?{data:{ok:true,entry},error:null}:{data:{...bank,entry:verified},error:null});
 jest.mocked(verifyFanZoneUpload).mockResolvedValue({ok:true,revision:2,digest:'a'.repeat(64),bytes:1024,duration_ms:1000});
 await act(async()=>{await view.result.current.saveDraft({uri:'file:private.mp4',alias:'Family Fan',caption:'Our family cheer',rights:true});});
 expect(mockUpload).toHaveBeenCalledWith('fan_zone',entry.path,expect.any(ArrayBuffer),{contentType:'video/mp4',upsert:false});expect(verifyFanZoneUpload).toHaveBeenCalledWith(entry.id,2);
 expect(mockRpc.mock.calls.filter(([fn])=>fn==='fun_permission')).toEqual([]);
 expect(view.result.current.snapshot?.entry?.verified).toBe(true);expect(view.result.current.error).toBeNull();
});
it('stops the private upload pipeline if identity changes during compression',async()=>{
 const view=await ready();const old=deferred<string>();jest.mocked(compressHighlight).mockImplementationOnce(()=>old.promise);const entry={...fanSnapshotFixture().entry!,status:'draft' as const};mockRpc.mockImplementation(async(fn:string)=>({data:fn==='fun_entry'?{ok:true,entry}:bank,error:null}));
 let work!:Promise<unknown>;await act(async()=>{work=view.result.current.saveDraft({uri:'file:private.mp4',alias:'Family Fan',caption:'Our family cheer',rights:true});});
 mockAuth={...mockAuth,user:{id:'auth-b'},profile:{id:FUN_IDS.admin,user_id:'auth-b'}};await view.rerender({});await act(async()=>{old.resolve('file:compressed.mp4');await work;});expect(mockUpload).not.toHaveBeenCalled();expect(verifyFanZoneUpload).not.toHaveBeenCalled();
});
it('continues a prior deletion request and reports partial versus server-completed all-revision removal',async()=>{
 bank=fanSnapshotFixture();const view=await ready();jest.mocked(removeFanZoneMedia).mockResolvedValueOnce({ok:true,revision:1,entry:FUN_IDS.entry,completed:false,status:'revision_removed'} as never).mockRejectedValueOnce(new Error('private removal path'));
 await act(async()=>{await view.result.current.removeAll(bank.entry!);});expect(view.result.current.removal).toMatchObject({removed:1,total:2,completed:false});expect(view.result.current.error).not.toMatch(/private removal path/);
});
it('recovers an uncertain private INSERT by verifying the same revision without another overwrite',async()=>{
 const view=await ready();const entry={...fanSnapshotFixture().entry!,status:'draft' as const,verified:false,digest:null,bytes:null,duration_ms:null,consent_scope:{...fanSnapshotFixture().entry!.consent_scope,digest:null}};
 const verified={...entry,verified:true,digest:'a'.repeat(64),bytes:1024,duration_ms:1000,consent_scope:{...entry.consent_scope,digest:'a'.repeat(64)}};
 mockRpc.mockImplementation(async(fn:string)=>({data:fn==='fun_entry'?{ok:true,entry}:{...bank,entry:verified},error:null}));mockUpload.mockRejectedValueOnce(new Error('lost response'));
 jest.mocked(verifyFanZoneUpload).mockResolvedValue({ok:true,revision:2,digest:'a'.repeat(64),bytes:1024,duration_ms:1000});
 await act(async()=>{await view.result.current.saveDraft({uri:'file:private.mp4',alias:'Family Fan',caption:'Our family cheer',rights:true});});expect(view.result.current.uploadPending).toBe(true);
 await act(async()=>{await view.result.current.retryUpload();});expect(mockUpload).toHaveBeenCalledTimes(1);expect(verifyFanZoneUpload).toHaveBeenCalledWith(entry.id,2);expect(view.result.current.uploadPending).toBe(false);expect(view.result.current.snapshot?.entry?.verified).toBe(true);
});
it('does not fabricate verified permission scope from an invalid verification receipt',async()=>{
 const view=await ready();const entry={...fanSnapshotFixture().entry!,status:'draft' as const,verified:false,digest:null,bytes:null,duration_ms:null,consent_scope:{...fanSnapshotFixture().entry!.consent_scope,digest:null}};mockRpc.mockImplementation(async()=>({data:{ok:true,entry},error:null}));
 jest.mocked(verifyFanZoneUpload).mockResolvedValue({ok:true,revision:99,digest:'a'.repeat(64),bytes:1024,duration_ms:1000});
 await act(async()=>{await view.result.current.saveDraft({uri:'file:private.mp4',alias:'Family Fan',caption:'Our family cheer',rights:true});});expect(view.result.current.snapshot?.entry?.verified).toBe(false);expect(view.result.current.uploadPending).toBe(true);expect(view.result.current.error).toMatch(/incomplete data/i);
});
it('ignores a prior canonical identity write-follow-up ballot read',async()=>{
 const view=await ready();const old=deferred<unknown>();mockRpc.mockImplementation((fn:string,args:Record<string,unknown>)=>fn==='fun_vote'?Promise.resolve({data:{ok:true,request_id:args.p_request_id,ballot:{id:FUN_IDS.ballot,campaign_id:FUN_IDS.campaign,entry_id:FUN_IDS.entry,version:1,invalidated:false}},error:null}):old.promise);
 let work!:Promise<unknown>;await act(async()=>{work=view.result.current.vote(FUN_IDS.entry);});await waitFor(()=>expect(mockRpc.mock.calls.filter(([fn])=>fn==='fun_snapshot')).toHaveLength(2));
 mockAuth={...mockAuth,profile:{...mockAuth.profile,id:FUN_IDS.admin}};mockRpc.mockResolvedValue({data:bank,error:null});await view.rerender({});await waitFor(()=>expect(view.result.current.loading).toBe(false));
 await act(async()=>{old.resolve({data:{...bank,ballot:{id:FUN_IDS.ballot,campaign_id:FUN_IDS.campaign,entry_id:FUN_IDS.entry,version:1,invalidated:false}},error:null});await work;});expect(view.result.current.snapshot?.ballot).toBeNull();expect(view.result.current.pendingBallot).toBeNull();
});
it('confirms all-revision removal only from matching actual API receipts',async()=>{
 bank=fanSnapshotFixture();const view=await ready();jest.mocked(removeFanZoneMedia).mockResolvedValueOnce({ok:true,revision:1,entry:FUN_IDS.entry,completed:false,status:'revision_removed'} as never).mockResolvedValueOnce({ok:true,revision:2,entry:FUN_IDS.entry,completed:true,status:'removed'} as never);
 await act(async()=>{await view.result.current.removeAll(bank.entry!);});expect(removeFanZoneMedia).toHaveBeenNthCalledWith(1,FUN_IDS.entry,1);expect(removeFanZoneMedia).toHaveBeenNthCalledWith(2,FUN_IDS.entry,2);expect(view.result.current.removal).toMatchObject({removed:2,total:2,completed:true});
});

it.each(['assent', 'grant'] as const)('invalidates refused %s scope before its authoritative refresh and resets review even for equal current scope', async action => {
 bank=fanSnapshotFixture();if(action==='grant')bank={...bank,entry:null,guardian_queue:[bank.entry!]};
 const view=await ready();const oldEntry=bank.entry??bank.guardian_queue[0],next=deferred<unknown>();
 mockRpc.mockImplementation((fn:string)=>fn==='fun_permission'?Promise.resolve({data:null,error:{message:'FUN_PERMISSION_SCOPE_STALE'}}):next.promise);
 let write!:Promise<unknown>;await act(async()=>{write=view.result.current.permission(oldEntry,action);});
 await waitFor(()=>expect(view.result.current.loading).toBe(true));expect(view.result.current.snapshot).toBeNull();
 await act(async()=>{next.resolve({data:bank,error:null});await write;});
 expect(view.result.current.snapshot).toEqual(bank);expect(view.result.current.permissionReviewEpoch).toBe(1);expect(view.result.current.error).toMatch(/review the exact revision again/);
 expect(mockRpc.mock.calls.filter(([fn])=>fn==='fun_permission')).toHaveLength(1);
});
it('keeps private permission scope unavailable when the stale-refusal refresh fails',async()=>{
 bank=fanSnapshotFixture();const view=await ready();const entry=bank.entry!;
 mockRpc.mockImplementation(async(fn:string)=>({data:null,error:{message:fn==='fun_permission'?'FUN_PERMISSION_SCOPE_STALE':'FUN_CAMPAIGN_UNAVAILABLE'}}));
 await act(async()=>{await view.result.current.permission(entry,'assent');});
 expect(view.result.current.snapshot).toBeNull();expect(view.result.current.loading).toBe(false);expect(view.result.current.permissionReviewEpoch).toBe(1);
 await act(async()=>{await view.result.current.permission(entry,'assent');});expect(mockRpc.mock.calls.filter(([fn])=>fn==='fun_permission')).toHaveLength(1);
});

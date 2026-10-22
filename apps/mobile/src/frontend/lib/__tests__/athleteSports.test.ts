/** Profile-owned sport snapshots reject lossy writes and malformed/stale server confirmations. */
const mockRpc = jest.fn();
const mockIssue = jest.fn();
jest.mock('@/services/TelemetryManager',()=>({telemetry:{trackIssue:(...args:unknown[])=>mockIssue(...args)}}));
jest.mock('@/lib/supabase', () => ({ isSupabaseConfigured: true, supabase: { rpc: (...args: unknown[]) => mockRpc(...args) } }));
import { fetchAthleteSports, saveAthleteSports, fetchAdminAthleteSports, saveAdminHighlightSport, fetchAdminHighlightSport } from '@/lib/athleteSports';
import { NOT_SWITCHED_ON } from '@/lib/rpc';
const entry = { sport:'Football', schoolId:null, teamName:null, position:'QB', jersey:'7' };
const raw = { profile_id:'p1', primary_sport:'Football', revision:2, sports:[{sport:'Football',school_id:null,team_name:null,position:'QB',jersey:'7'}] };
beforeEach(()=>{mockIssue.mockReset();mockRpc.mockReset().mockResolvedValue({data:raw,error:null});});
it('maps the confirmed profile snapshot and exact RPC arguments',async()=>{
 await expect(saveAthleteSports('p1','Football',[entry],1)).resolves.toEqual({profileId:'p1',primarySport:'Football',revision:2,sports:[entry]});
 expect(mockRpc).toHaveBeenCalledWith('set_athlete_sports',{p_profile_id:'p1',p_primary_sport:'Football',p_sports:raw.sports,p_expected_revision:1});
});
it('returns null for a denied public scope',async()=>{mockRpc.mockResolvedValue({data:null,error:null});await expect(fetchAthleteSports('p1')).resolves.toBeNull();});
it('missing source save is explicit and never retried',async()=>{mockRpc.mockResolvedValue({data:null,error:{code:'PGRST202',message:'missing function'}});await expect(saveAthleteSports('p1','Football',[entry],1)).rejects.toThrow(NOT_SWITCHED_ON);expect(mockRpc).toHaveBeenCalledTimes(1);});
it.each([null,0,{...raw,revision:1},{...raw,profile_id:'other'},{...raw,sports:[]},{...raw,primary_sport:'Rugby'},{...raw,sports:[{sport:'Football'}]}])('rejects a malformed or stale write confirmation %#',async(data)=>{mockRpc.mockResolvedValue({data,error:null});await expect(saveAthleteSports('p1','Football',[entry],1)).rejects.toThrow();});
it('validates primary membership and duplicates before writing',async()=>{await expect(saveAthleteSports('p1','Rugby',[entry],1)).rejects.toThrow();await expect(saveAthleteSports('p1','Football',[entry,entry],1)).rejects.toThrow();expect(mockRpc).not.toHaveBeenCalled();});
it('bounds admin results to forty and maps extra identity fields',async()=>{mockRpc.mockResolvedValue({data:[{...raw,full_name:'Ana',username:'ana',player_id:null}],error:null});await expect(fetchAdminAthleteSports(' ana ')).resolves.toEqual([{profileId:'p1',primarySport:'Football',revision:2,sports:[entry],fullName:'Ana',username:'ana',playerId:null}]);expect(mockRpc).toHaveBeenCalledWith('admin_list_athlete_sports',{p_search:'ana',p_limit:40});});
it.each([{...raw,sports:[{...raw.sports[0],jersey:'99'}]},{...raw,primary_sport:'Rugby',sports:[{...raw.sports[0],sport:'Rugby'}]}])('rejects contradictory write confirmation %#',async(data)=>{mockRpc.mockResolvedValue({data,error:null});await expect(saveAthleteSports('p1','Football',[entry],1)).rejects.toThrow();});
it('accepts only server-normalized equivalent credentials',async()=>{await expect(saveAthleteSports('p1',' football ',[{...entry,sport:' football ',position:' QB ',jersey:' 7 ',teamName:' '}],1)).resolves.toMatchObject({primarySport:'Football'});});
it('reports a fixed revision code without identity or exception text',async()=>{mockRpc.mockResolvedValue({data:null,error:{message:'ATHLETE_SPORTS_REVISION_CONFLICT private name'}});await expect(saveAthleteSports('p1','Football',[entry],1)).rejects.toThrow();expect(mockIssue).toHaveBeenCalledWith('athlete_sports_revision_conflict','profile');expect(JSON.stringify(mockIssue.mock.calls)).not.toMatch(/p1|private name|Football/);});

it('repairs a recorded Highlight only with exact CAS confirmation',async()=>{mockRpc.mockResolvedValue({data:{id:'r1',sport:'Volleyball'},error:null});await expect(saveAdminHighlightSport('r1','Volleyball','Football')).resolves.toEqual({id:'r1',sport:'Volleyball'});expect(mockRpc).toHaveBeenCalledWith('admin_set_highlight_sport',{p_reel_id:'r1',p_sport:'Volleyball',p_expected_sport:'Football'});});
it('rejects a contradictory Highlight repair readback',async()=>{mockRpc.mockResolvedValue({data:{id:'r1',sport:'Rugby'},error:null});await expect(saveAdminHighlightSport('r1','Volleyball','Football')).rejects.toThrow();});

it('requires the recorded-sport read to confirm the requested Highlight identity',async()=>{
 mockRpc.mockResolvedValue({data:{id:'other',sport:'Football'},error:null});await expect(fetchAdminHighlightSport('r1')).rejects.toThrow();
 mockRpc.mockResolvedValue({data:{id:'r1',sport:null},error:null});await expect(fetchAdminHighlightSport('r1')).resolves.toEqual({id:'r1',sport:null});
});

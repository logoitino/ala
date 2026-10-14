/** FUN-01 adapter tests use the real bound RPC path and complete SQL wire fixtures, never direct tables. */
import { fanZoneRpc, fetchFanZoneAdmin, fanZoneReasonValid, FanZoneError, removeFanZoneRevision } from '@/lib/fanZone';
import { fanAdminFixture, fanSnapshotFixture, FUN_IDS } from './fanZoneFixtures';
import type { FanZoneRpcMap } from '@shared/fanZone';

const mockTransport = jest.fn();
const mockClient = { rpc(fn: string, args: unknown) { if (this !== mockClient) throw new Error('Lost binding'); return mockTransport(fn, args); } };
jest.mock('@/lib/supabase', () => ({ isSupabaseConfigured: true, get supabase() { return mockClient; } }));
jest.mock('@/lib/fanZoneMedia', () => ({ removeFanZoneMedia: jest.fn() }));
import { removeFanZoneMedia } from '@/lib/fanZoneMedia';
beforeEach(() => { jest.clearAllMocks(); mockTransport.mockResolvedValue({ data: fanAdminFixture(), error: null }); });
it('uses the bound RPC and exact independent paging arguments', async () => {
 await expect(fetchFanZoneAdmin(FUN_IDS.campaign, '2026-10-13T00:00:00Z')).resolves.toEqual(fanAdminFixture());
 expect(mockTransport).toHaveBeenCalledWith('fun_admin_snapshot', { p_campaign_id: FUN_IDS.campaign, p_before: '2026-10-13T00:00:00Z' });
});
it.each(['FUN_PERMISSION_SCOPE_STALE', 'FUN_CASE_RATE_LIMIT', 'FUN_DELETION_ALREADY_REQUESTED', 'FUN_BALLOT_VERSION_STALE'])('returns a fixed typed safe error for %s', async code => {
 mockTransport.mockResolvedValue({ data: null, error: { code: 'P0001', message: code } });
 await expect(fetchFanZoneAdmin()).rejects.toMatchObject({ code });
 await expect(fetchFanZoneAdmin()).rejects.toBeInstanceOf(FanZoneError);
});
it.each(['Private caption and guardian details', 'FUN_CASE_INVALID: private report text', 'token=secret'])('does not echo unknown backend text %s', async message => {
 mockTransport.mockResolvedValue({ data: null, error: { message } });
 await expect(fetchFanZoneAdmin()).rejects.toMatchObject({ code: 'FUN_UNAVAILABLE', message: 'Fan Zone is unavailable. Refresh or contact Support.' });
});
it('maps missing SQL to visible unavailable and rejects malformed arrays/counts', async () => {
 mockTransport.mockResolvedValueOnce({ data: null, error: { code: 'PGRST202', message: 'Private migration details' } });
 await expect(fetchFanZoneAdmin()).rejects.toMatchObject({ code: 'FUN_NOT_APPLIED' });
 for (const data of [null, { ...fanAdminFixture(), entries: [{}] }, { ...fanAdminFixture(), counts: { ...fanAdminFixture().counts, entries: '0' } }, { ...fanAdminFixture(), entries: Array(101).fill(fanAdminFixture().entries[0]) }]) {
  mockTransport.mockResolvedValueOnce({ data, error: null }); await expect(fetchFanZoneAdmin()).rejects.toMatchObject({ code: 'FUN_INVALID_RESPONSE' });
 }
});
it('accepts SQL-valid Unicode and untrimmed persisted content without silently dropping rows', async () => {
 const value = fanAdminFixture(); value.campaign!.title = '😀'.repeat(80); value.campaign!.theme = '\t'; value.campaigns[0] = value.campaign!;
 value.entries[0].alias = '😀'.repeat(40); value.entries[0].caption = '\t'; value.entries[0].consent_scope.alias = value.entries[0].alias; value.entries[0].consent_scope.caption = '\t';
 value.cases[0].details = '😀'.repeat(1000); value.entries[0].reason = '';
 mockTransport.mockResolvedValue({ data: value, error: null }); await expect(fetchFanZoneAdmin()).resolves.toEqual(value);
});
it('rejects public candidate/private tester leakage and a stale nested exact consent scope', async () => {
 const value = fanSnapshotFixture();
 mockTransport.mockResolvedValueOnce({data:value,error:null});await expect(fanZoneRpc('fun_snapshot',{p_campaign_id:FUN_IDS.campaign})).resolves.toEqual(value);
 for (const data of [{ ...value, candidates: [{ ...value.candidates[0], owner_id: FUN_IDS.owner }] }, { ...value, candidates: [{ ...value.candidates[0], voter_id: FUN_IDS.owner }] }, { ...value, campaign: { ...value.campaign, pilot_accounts: [FUN_IDS.owner] } }, { ...value, entry: { ...value.entry, consent_scope: { ...value.entry!.consent_scope, revision: 1 } } }]) {
  mockTransport.mockResolvedValueOnce({ data, error: null }); await expect(fanZoneRpc('fun_snapshot', { p_campaign_id: FUN_IDS.campaign })).rejects.toMatchObject({ code: 'FUN_INVALID_RESPONSE' });
 }
});
it('passes exact consent scope and ballot request/version untouched', async () => {
 const value = fanAdminFixture().entries[0]; mockTransport.mockResolvedValueOnce({ data: { ok: true, entry: value }, error: null });
 await fanZoneRpc('fun_permission', { p_entry_id: value.id, p_revision: value.revision, p_action: 'grant', p_expected_scope: value.consent_scope });
 expect(mockTransport).toHaveBeenLastCalledWith('fun_permission', { p_entry_id: value.id, p_revision: 2, p_action: 'grant', p_expected_scope: value.consent_scope });
 const args = { p_campaign_id: FUN_IDS.campaign, p_entry_id: value.id, p_request_id: FUN_IDS.audit, p_expected_version: 3 };
 const receipt: FanZoneRpcMap['fun_vote']['result'] = { ok: true, request_id: FUN_IDS.audit, ballot: { id: FUN_IDS.ballot, campaign_id: FUN_IDS.campaign, entry_id: value.id, version: 4, invalidated: false } };
 mockTransport.mockResolvedValue({ data: receipt, error: null }); await expect(fanZoneRpc('fun_vote', args)).resolves.toEqual(receipt); expect(mockTransport).toHaveBeenLastCalledWith('fun_vote', args);
});
it('accepts only an actual matching API removal completion receipt', async () => {
 const remove = jest.mocked(removeFanZoneMedia);
 const partial={ ok: true as const, entry:FUN_IDS.entry, revision: 1, completed: false, status: 'revision_removed' };remove.mockResolvedValueOnce(partial);
 await expect(removeFanZoneRevision(FUN_IDS.entry,1)).resolves.toMatchObject({ completed: false });
 remove.mockResolvedValueOnce({ ok: true, revision: 2 }); await expect(removeFanZoneRevision(FUN_IDS.entry,2)).rejects.toMatchObject({ code: 'FUN_INVALID_RESPONSE' });
 const mismatch={ ok: true as const, entry:FUN_IDS.entry, revision: 1, completed: true, status: 'removed' };remove.mockResolvedValueOnce(mismatch); await expect(removeFanZoneRevision(FUN_IDS.entry,2)).rejects.toMatchObject({ code: 'FUN_INVALID_RESPONSE' });
 const otherEntry={...mismatch,entry:FUN_IDS.owner,revision:2};remove.mockResolvedValueOnce(otherEntry);await expect(removeFanZoneRevision(FUN_IDS.entry,2)).rejects.toMatchObject({code:'FUN_INVALID_RESPONSE'});
});
it('rejects inconsistent selected populations instead of inventing valid ballot counts',async()=>{
 const countMismatch=fanAdminFixture();countMismatch.ballots[0].valid=false;
 const wrongCampaign=fanAdminFixture();wrongCampaign.entries[0].campaign_id=FUN_IDS.owner;wrongCampaign.entries[0].consent_scope.campaign_id=FUN_IDS.owner;
 for(const data of [countMismatch,wrongCampaign]){mockTransport.mockResolvedValueOnce({data,error:null});await expect(fetchFanZoneAdmin()).rejects.toMatchObject({code:'FUN_INVALID_RESPONSE'});}
});
it('rejects an unrelated ballot request receipt and never calls service-only or helper RPCs',async()=>{
 mockTransport.mockResolvedValue({data:{ok:true,request_id:FUN_IDS.owner,ballot:{id:FUN_IDS.ballot,campaign_id:FUN_IDS.campaign,entry_id:FUN_IDS.entry,version:1,invalidated:false}},error:null});
 await expect(fanZoneRpc('fun_vote',{p_campaign_id:FUN_IDS.campaign,p_entry_id:FUN_IDS.entry,p_request_id:FUN_IDS.audit,p_expected_version:0})).rejects.toMatchObject({code:'FUN_INVALID_RESPONSE'});
 mockTransport.mockClear();for(const name of ['fun_verify_media','fun_complete_removal','fun_guardian_grant_valid'])await expect(Reflect.apply(fanZoneRpc,undefined,[name,{}])).rejects.toMatchObject({code:'FUN_INVALID_REQUEST'});
 expect(mockTransport).not.toHaveBeenCalled();
});
it('matches both raw persisted reason length and SQL ASCII-space trim',()=>{
 expect(fanZoneReasonValid('😀'.repeat(500))).toBe(true);expect(fanZoneReasonValid(' '+'a'.repeat(500))).toBe(false);
 expect(fanZoneReasonValid('\t'.repeat(5))).toBe(true);expect(fanZoneReasonValid('  four  ')).toBe(false);
});

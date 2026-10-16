/**
 * FUN-01 admin-first operations: complete selected Data, private review, proven ballot corrections and tracked removal.
 * @sideEffects Bound admin RPCs/caller-authorized media API, and existing Analytics/Health/Support navigation.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { randomUUID } from 'expo-crypto';
import { AdminBtn, AdminField, AdminMetrics, AdminNotice, AdminPage, AdminPanel, AdminPills } from '@/components/Admin/AdminChrome';
import { AdminShell } from '@/components/Admin/AdminShell';
import { useAdminAction } from '@/hooks/useAdminAction';
import { FanZoneError, fanZoneReasonValid, fanZoneRpc, fetchFanZoneAdmin, removeFanZoneRevision, type FanZoneAdminSnapshot, type FanZoneCampaignAction, type FanZoneCampaignPayload, type FanZoneReviewAction } from '@/lib/fanZone';
import { FanZoneCampaignPanel } from './FanZoneCampaignPanel';
import { FanZoneData, FanZoneEntryData } from './FanZoneData';
import { FanZoneVideoReview } from './FanZoneVideoReview';
/** @purpose Gate mounting and all private reads with the existing admin shell; SQL independently verifies the actor. */
export function FanZoneScreen() { return <AdminShell><FanZoneDesk /></AdminShell>; }
const campaignNotices: Record<FanZoneCampaignAction, string> = {
    create: 'Testing draft created. It remains closed until approved testers and support are configured.',
    configure: 'Draft campaign configuration saved.', open: 'Campaign opened for approved testers only.', pause: 'Campaign paused. New entries and ballots are stopped.',
    close: 'Campaign closed. No new entries or ballots.', finalize: 'Valid ballot results finalized under the published tie rules.', recount: 'Valid ballots recounted; corrected results saved.',
};
const merge = <T extends {
    id: string;
}>(old: T[], next: T[]) => [...new Map([...old, ...next].map(row => [row.id, row])).values()];
const safeMessage = (caught: unknown) => caught instanceof FanZoneError ? caught.message : new FanZoneError('FUN_UNAVAILABLE').message;
/** @purpose Operate the approved testing pilot without fan discovery, public identities or staff-selected winners. */
function FanZoneDesk() {
    const router = useRouter();
    const [data, setData] = useState<FanZoneAdminSnapshot | null>(null), [error, setError] = useState<string | null>(null), [loading, setLoading] = useState(true), [readAt, setReadAt] = useState<string | null>(null);
    const [tab, setTab] = useState<'operate' | 'data'>('operate'), [entryId, setEntryId] = useState<string | null>(null), [ballotId, setBallotId] = useState<string | null>(null), [caseId, setCaseId] = useState<string | null>(null);
    const [reason, setReason] = useState(''), [proven, setProven] = useState(false), [removal, setRemoval] = useState<string | null>(null);
    const live = useRef(true), generation = useRef(0), selectedCampaign = useRef<string | null>(null), deletionRequest = useRef<{
        entry: string;
        details: string;
        secret: string;
    } | null>(null);
    const load = useCallback(async (campaignId: string | null = selectedCampaign.current) => {
        const request = ++generation.current;
        if (live.current)
            setLoading(true);
        try {
            const next = await fetchFanZoneAdmin(campaignId);
            if (live.current && request === generation.current) {
                selectedCampaign.current = next.campaign?.id ?? campaignId;
                setData(next);
                setError(null);
                setReadAt(new Date().toISOString());
            }
        }
        catch (caught) {
            if (live.current && request === generation.current) {
                setData(null);
                setError(safeMessage(caught));
            }
        }
        finally {
            if (live.current && request === generation.current)
                setLoading(false);
        }
    }, []);
    useEffect(() => { live.current = true; void load(); return () => { live.current = false; generation.current++; }; }, [load]);
    const { busy, message, run } = useAdminAction();
    const disabled = !!busy || loading;
    const entry = data?.entries.find(e => e.id === entryId) ?? null, ballot = data?.ballots.find(b => b.id === ballotId) ?? null, caseRow = data?.cases.find(c => c.id === caseId) ?? null;
    const hasReason = fanZoneReasonValid(reason);
    const chooseCampaign = (id: string) => { selectedCampaign.current = id; setEntryId(null); setBallotId(null); setCaseId(null); setRemoval(null); setReason(''); deletionRequest.current = null; void load(id); };
    const campaignAction = (id: string | null, action: FanZoneCampaignAction, payload: FanZoneCampaignPayload) => {
        void run(action, async () => { const receipt = await fanZoneRpc('fun_admin_campaign', { p_id: id, p_action: action, p_payload: payload }); selectedCampaign.current = receipt.campaign.id; await load(receipt.campaign.id); return campaignNotices[action]; });
    };
    const review = (action: FanZoneReviewAction, emergency = false) => {
        if (!entry) return;
        // Retain the rendered scope across the asynchronous write; refreshing cannot substitute an unseen revision.
        const reviewed = entry;
        void run(action, async () => {
            try {
                await fanZoneRpc('fun_admin_entry', { p_entry_id: reviewed.id, p_action: action, p_reason: reason, p_expected_scope: emergency ? null : reviewed.consent_scope });
            } catch (caught) {
                if (caught instanceof FanZoneError && caught.code === 'FUN_REVIEW_SCOPE_STALE') {
                    setEntryId(null); setReason(''); await load();
                }
                throw caught;
            }
            setReason(''); await load();
            return emergency ? 'Current entry suspended for an emergency safety hold.' : 'Entry review saved. Public exposure still requires exact current permission.';
        });
    };
    const invalidate = () => { if (!ballot || !proven || !hasReason)
        return; void run('invalidate', async () => { await fanZoneRpc('fun_admin_ballot', { p_ballot_id: ballot.id, p_reason: reason }); setReason(''); setProven(false); await load(); return 'Ballot invalidated with a reason. Review and recount valid ballots after the deadline.'; }); };
    const handleCase = (action: 'resolve' | 'escalate') => { if (!caseRow)
        return; void run(action, async () => { await fanZoneRpc('fun_admin_case', { p_case_id: caseRow.id, p_action: action, p_reason: reason }); setReason(''); await load(); return action === 'resolve' ? 'Case resolved with a recorded reason.' : 'Case escalated with a recorded reason.'; }); };
    const requestDeletion = () => {
        if (!entry || !hasReason)
            return;
        // Preserve request secret/details through uncertain failures; a retry must not create a second deletion.
        if (!deletionRequest.current || deletionRequest.current.entry !== entry.id || deletionRequest.current.details !== reason)
            deletionRequest.current = { entry: entry.id, details: reason, secret: randomUUID() };
        const request = deletionRequest.current;
        void run('deletion', async () => { await fanZoneRpc('fun_case', { p_entry_id: request.entry, p_kind: 'deletion', p_details: request.details, p_secret: request.secret }); await load(); return 'Deletion requested. Media is not yet removed; complete all stored revisions below.'; });
    };
    const removeAll = () => {
        if (!entry)
            return;
        const revisions = entry.media_revisions.filter(m => m.present).map(m => m.revision);
        if (revisions.length === 0)
            revisions.push(entry.revision);
        void run('removal', async () => {
            let removed = 0, completed = false;
            setRemoval(`0 of ${revisions.length} revisions removed; completion not confirmed.`);
            try {
                for (const revision of revisions) {
                    const receipt = await removeFanZoneRevision(entry.id, revision);
                    removed++;
                    completed = receipt.completed;
                    setRemoval(`${removed} of ${revisions.length} revisions removed; completion not confirmed.`);
                }
            }
            catch (caught) {
                setRemoval(`${removed} of ${revisions.length} revisions removed; completion not confirmed. Refresh and retry the remaining objects.`);
                await load();
                throw caught;
            }
            await load();
            if (completed) {
                setRemoval('All stored revisions removed; server completion confirmed.');
                return 'Removal receipt completed.';
            }
            setRemoval(`${removed} of ${revisions.length} revisions removed; completion not confirmed. Refresh and retry to confirm every object is absent.`);
            return 'Removal remains pending. No completion receipt was returned.';
        });
    };
    const more = (kind: 'cases' | 'audit') => {
        if (!data?.campaign)
            return;
        const campaignId = data.campaign.id, cursor = kind === 'cases' ? data.case_next_cursor : data.audit_next_cursor;
        if (!cursor)
            return;
        void run(`page_${kind}`, async () => {
            const next = await fetchFanZoneAdmin(campaignId, cursor);
            if (next.campaign?.id !== campaignId)
                throw new FanZoneError('FUN_INVALID_RESPONSE');
            if (live.current)
                setData(old => old && old.campaign?.id === campaignId ? { ...next, cases: kind === 'cases' ? merge(old.cases, next.cases) : old.cases, audit: kind === 'audit' ? merge(old.audit, next.audit) : old.audit, case_next_cursor: kind === 'cases' ? next.case_next_cursor : old.case_next_cursor, audit_next_cursor: kind === 'audit' ? next.audit_next_cursor : old.audit_next_cursor } : old);
            return `Earlier ${kind} loaded.`;
        });
    };
    const hasDeletion = !!entry && data?.cases.some(c => c.entry_id === entry.id && c.kind === 'deletion' && ['open', 'escalated'].includes(c.status));
    return <AdminPage title="Fan Zone" lede="Private review and free ballots for the approved testing audience. Local implementation; hosted access, consent language and release remain unverified." refreshing={loading} onRefresh={() => { if (!busy)
        void load(); }} error={error}>
  <View style={styles.actions}>{(['analytics', 'health', 'support'] as const).map(path => <AdminBtn key={path} label={path === 'analytics' ? 'Analytics' : path === 'health' ? 'Health' : 'Support'} onPress={() => router.push(`/admin/${path}` as Href)}/>)}</View>
  <AdminBtn label="Refresh source" disabled={disabled} onPress={() => void load()}/>
  <AdminNotice text={message?.text ?? null} tone={message?.tone}/>
  {loading && !data && !error ? <Text>Reading Fan Zone source…</Text> : null}
  {data ? <>
   <Text>{`Source read ${readAt ?? 'pending'} (client observation). Selected campaign entries and ballots are complete; cases/audit are paged.`}</Text>
   <AdminPanel title="Select campaign">
    <Text>{`${data.campaigns.length} latest campaigns loaded (limit 100). Select an older known campaign ID below if needed.`}</Text>
    {data.campaigns.map(c => <AdminBtn key={c.id} label={`Select campaign ${c.title}`} disabled={disabled} onPress={() => chooseCampaign(c.id)}/>)}
    <OlderCampaign busy={disabled} onSelect={chooseCampaign}/>
   </AdminPanel>
   <FanZoneCampaignPanel campaign={data.campaign} busy={disabled} onAction={campaignAction}/>
   {data.campaign ? <>
    <AdminPanel title="Selected campaign data"><Text>{`${data.campaign.title} · ${data.campaign.status} · testing only`}</Text>
     <Text>{`Entry window ${data.campaign.entry_opens_at} to ${data.campaign.entry_closes_at}. Voting ${data.campaign.vote_opens_at} to ${data.campaign.vote_closes_at}; end excluded.`}</Text>
     <Text>{`Support contact: ${data.campaign.support_contact || 'not configured'}`}</Text>
     <AdminMetrics items={[{ label: 'Stored entries', value: data.counts.entries, hint: 'Complete selected campaign, maximum 100' }, { label: 'Stored ballots', value: data.counts.ballots, hint: 'All account ballots in selected campaign' }, { label: 'Currently valid ballots', value: data.counts.valid_ballots, hint: 'Current account/permission/correction checks' }, { label: 'Cases', value: data.counts.cases, hint: 'All selected-entry cases' }, { label: 'Open or escalated cases', value: data.counts.open_cases }, { label: 'Audit records', value: data.counts.audit, hint: 'All selected-campaign audit' }]}/>
     <Text>{`Entry status counts: ${JSON.stringify(data.counts.entry_statuses)}`}</Text>
     <Text>{data.campaign.recount_required ? 'Recount required. Stored results may be stale; refinalize valid ballots.' : 'No recount flag recorded. Current authorization still applies.'}</Text>
     <Text selectable>{`Stored finalization results: ${JSON.stringify(data.campaign.results)}`}</Text>
    </AdminPanel>
    <AdminPills label="Fan Zone desk" items={[{ id: 'operate', label: 'Operate' }, { id: 'data', label: 'Data' }]} value={tab} onChange={value => { if (!busy)
                setTab(value); }}/>
    {tab === 'data' ? <FanZoneData data={data} busy={disabled} onMore={more}/> : <>
     <AdminField label="Review or action reason" value={reason} onChangeText={setReason} multiline placeholder="5–500 characters; recorded privately with the action"/>
     <AdminPanel title="Private entry review">
      {data.entries.length === 0 ? <Text>No entries in the selected campaign.</Text> : data.entries.map(e => <AdminBtn key={e.id} label={`Review entry ${e.alias || e.id}`} disabled={disabled} onPress={() => { setEntryId(e.id); setRemoval(null); deletionRequest.current = null; }}/>)}
      {entry ? <>
       <FanZoneEntryData entry={entry}/><FanZoneVideoReview key={`${entry.id}:${entry.revision}`} entryId={entry.id} revision={entry.revision}/>
       <View style={styles.actions}>
        <AdminBtn label="Accept entry" kind="primary" disabled={disabled || !hasReason || !['submitted', 'suspended'].includes(entry.status) || !entry.verified || !entry.rights_confirmed || !!entry.removed_at} onPress={() => review('accept')}/>
        <AdminBtn label="Request changes" disabled={disabled || !hasReason || entry.status === 'withdrawn'} onPress={() => review('changes')}/>
        <AdminBtn label="Reject entry" kind="danger" disabled={disabled || !hasReason || entry.status === 'withdrawn'} onPress={() => review('reject')}/>
        <AdminBtn label="Suspend entry" kind="danger" disabled={disabled || !hasReason || entry.status === 'withdrawn'} onPress={() => review('suspend')}/>
        <AdminBtn label="Emergency suspend current entry" kind="danger" disabled={disabled || !hasReason || entry.status === 'withdrawn'} onPress={() => review('suspend', true)}/>
        <AdminBtn label="Request tracked deletion" kind="danger" disabled={disabled || !hasReason || !!hasDeletion} onPress={requestDeletion}/>
        {/* A tracked deletion may be outside the loaded case page; the API checks its existence on every revision. */}
        <AdminBtn label="Remove all stored revisions" kind="danger" disabled={disabled} onPress={removeAll}/>
       </View><AdminNotice text={removal} tone={removal?.includes('server completion confirmed') ? 'ok' : 'warn'}/>
       <Text>Staff may initiate tracked deletion even for an owner whose account is blocked/closed. Removal requires a tracked deletion in the server, including an older paged case. Server authorization and actual object absence decide completion.</Text>
       <Text>Normal review is bound to this exact revision, media and caption. Emergency suspension stops the current entry even if it changed; it cannot accept or publish a replacement.</Text>
      </> : <Text>Select an entry before reviewing private video or taking corrective action.</Text>}
     </AdminPanel>
     <AdminPanel title="Proven ballot correction">
      <Text>Investigate evidence before invalidation. A malicious supporter does not prove entrant misconduct; staff never pick a preferred winner.</Text>
      {data.ballots.map(b => <AdminBtn key={b.id} label={`Review ballot ${b.id}`} disabled={disabled} onPress={() => { setBallotId(b.id); setProven(false); }}/>)}
      {ballot ? <><Text selectable>{JSON.stringify(ballot)}</Text><AdminPills label="Invalidity evidence" items={[{ id: 'unconfirmed', label: 'Not proven' }, { id: 'proven', label: 'Invalidity proven' }]} value={proven ? 'proven' : 'unconfirmed'} onChange={value => setProven(value === 'proven')}/>
       <AdminBtn label="Invalidate proven ballot" kind="danger" disabled={disabled || !proven || !hasReason || !!ballot.invalidated_at} onPress={invalidate}/></> : <Text>Select a ballot to review evidence.</Text>}
     </AdminPanel>
     <AdminPanel title="Case handling">
      <Text>{`${data.cases.length} loaded of ${data.counts.cases} cases; ${data.counts.open_cases} open/escalated.`}</Text>
      {data.cases.map(c => <AdminBtn key={c.id} label={`Review case ${c.id}`} disabled={disabled} onPress={() => setCaseId(c.id)}/>)}
      {caseRow ? <><Text selectable>{JSON.stringify(caseRow)}</Text><AdminBtn label="Escalate case" disabled={disabled || !hasReason || !['open', 'escalated'].includes(caseRow.status)} onPress={() => handleCase('escalate')}/>
       <AdminBtn label="Resolve case" disabled={disabled || !hasReason || caseRow.kind === 'deletion' || !['open', 'escalated'].includes(caseRow.status)} onPress={() => handleCase('resolve')}/>
       {caseRow.kind === 'deletion' ? <Text>Deletion cannot be manually resolved. Select its entry, remove every stored revision and await the server completion receipt.</Text> : null}</> : <Text>Select a case to review its private details.</Text>}
      <AdminBtn label="Load earlier cases" disabled={disabled || !data.case_next_cursor} onPress={() => more('cases')}/>
     </AdminPanel>
    </>}
   </> : <Text>No selected campaign. No stored entries or ballots are claimed for a failed selection.</Text>}
  </> : null}
 </AdminPage>;
}
/** @purpose A known older ID can select data beyond the explicitly bounded latest-campaign list. */
function OlderCampaign({ busy, onSelect }: {
    busy: boolean;
    onSelect: (id: string) => void;
}) {
    const [id, setId] = useState('');
    return <><AdminField label="Older campaign ID" value={id} onChangeText={setId}/><AdminBtn label="Select older campaign" disabled={busy || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)} onPress={() => onSelect(id)}/></>;
}
const styles = StyleSheet.create({ actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 } });

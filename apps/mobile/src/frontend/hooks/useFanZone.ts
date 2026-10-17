/**
 * FUN-01 identity-scoped pilot state and explicit private actions; uncertain ballots retain their original request.
 * @sideEffects Narrow RPC reads/writes, private Storage INSERT, compression/byte reads and authorized media API.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { randomUUID } from 'expo-crypto';
import { useAuth } from '@/context/AuthContext';
import { FanZoneError, fanZoneRpc, fetchFanZone, removeFanZoneRevision, uploadFanZoneVideo } from '@/lib/fanZone';
import { verifyFanZoneUpload } from '@/lib/fanZoneMedia';
import { bytesFromUri, compressHighlight } from '@/services/MediaUploadService';
import { FAN_ZONE_MEDIA_LIMITS, type FanZoneSnapshot, type FanZoneEntry, type FanZoneCase, type FanZoneCaseKind, type FanZonePermissionAction, type FanZoneReflectionIdea } from '@shared/fanZone';
export type FanZoneDraft = {
    uri: string;
    alias: string;
    caption: string;
    rights: boolean;
};
type PendingBallot = {
    campaignId: string;
    entryId: string;
    requestId: string;
    version: number;
    uncertain: boolean;
    confirmed: boolean;
};
export type FanZoneCaseRecord = {
    receipt: FanZoneCase;
    secret: string;
};
export type FanZoneRemoval = {
    entryId: string;
    removed: number;
    total: number;
    completed: boolean;
};
type Upload = {
    draft: FanZoneDraft;
    entry: FanZoneEntry;
    stage: 'insert' | 'uncertain' | 'verify';
};
type CaseRequest = {
    entryId: string;
    kind: FanZoneCaseKind;
    details: string;
    secret: string;
};
type Data = {
    snapshot: FanZoneSnapshot | null;
    loading: boolean;
    error: string | null;
    busy: string | null;
    notice: string | null;
    pendingBallot: PendingBallot | null;
    permissionReviewEpoch: number;
    cases: FanZoneCaseRecord[];
    removal: FanZoneRemoval | null;
};
type Scope = Data & {
    key: string | null;
    epoch: number;
    active: boolean;
    read: number;
    upload: Upload | null;
    caseRequest: CaseRequest | null;
};
const empty = (): Data => ({ snapshot: null, loading: false, error: null, busy: null, notice: null, pendingBallot: null, permissionReviewEpoch: 0, cases: [], removal: null });
const safe = (caught: unknown) => caught instanceof FanZoneError ? caught.message : 'Fan Zone could not confirm this action. Refresh or try again.';
const sameScope = (a: FanZoneEntry, b: FanZoneEntry) => a.id === b.id && a.revision === b.revision && JSON.stringify(a.consent_scope) === JSON.stringify(b.consent_scope);
const validDraft = (d: FanZoneDraft) => !!d.uri && Array.from(d.alias).length <= 40 && !!d.alias.replace(/^ +| +$/g, '') && Array.from(d.caption).length <= 240 && !!d.caption.replace(/^ +| +$/g, '') && d.rights;
/** @purpose Publish only the current canonical identity; no action resumes automatically after a new login. */
export function useFanZone(campaignId: string | null = null) {
    const auth = useAuth();
    const authenticated = !auth.isGuest && !!auth.user?.id && !!auth.profile?.id && auth.profile.user_id === auth.user.id;
    const key = auth.loading ? null : authenticated ? JSON.stringify([auth.user!.id, auth.profile!.id, campaignId]) : auth.isGuest ? JSON.stringify(['guest', auth.user?.id ?? null, campaignId]) : null;
    const ref = useRef<Scope>({ ...empty(), key, epoch: 0, active: false, read: 0, upload: null, caseRequest: null });
    if (ref.current.key !== key)
        ref.current = { ...empty(), key, epoch: ref.current.epoch + 1, active: false, read: 0, upload: null, caseRequest: null };
    const epoch = ref.current.epoch;
    const [view, setView] = useState<Data & {
        epoch: number;
    }>({ ...empty(), epoch: -1 });
    const current = useCallback(() => key !== null && ref.current.key === key && ref.current.epoch === epoch && ref.current.active, [key, epoch]);
    const publish = useCallback(() => {
        if (!current())
            return;
        const s = ref.current;
        setView({ epoch, snapshot: s.snapshot, loading: s.loading, error: s.error, busy: s.busy, notice: s.notice, pendingBallot: s.pendingBallot ? { ...s.pendingBallot } : null, permissionReviewEpoch: s.permissionReviewEpoch, cases: [...s.cases], removal: s.removal ? { ...s.removal } : null });
    }, [current, epoch]);
    const read = useCallback(async (afterWrite = false) => {
        if (!current() || !authenticated || (ref.current.busy && !afterWrite))
            return;
        const sequence = ++ref.current.read;
        ref.current.loading = true;
        publish();
        try {
            const next = await fetchFanZone(ref.current.pendingBallot?.campaignId ?? campaignId);
            if (!current() || sequence !== ref.current.read)
                return;
            ref.current.snapshot = next;
            ref.current.error = null;
            // A replay receipt describes the original mutation. Only this fresh read establishes the current ballot.
            if (ref.current.pendingBallot?.confirmed && next.campaign?.id === ref.current.pendingBallot.campaignId) {
                ref.current.pendingBallot = null;
                ref.current.notice = 'Current ballot refreshed from the server.';
            }
        }
        catch (caught) {
            if (current() && sequence === ref.current.read) {
                ref.current.snapshot = null;
                ref.current.error = safe(caught);
            }
        }
        finally {
            if (current() && sequence === ref.current.read) {
                ref.current.loading = false;
                publish();
            }
        }
    }, [authenticated, campaignId, current, publish]);
    const refresh = useCallback(() => read(), [read]);
    useEffect(() => {
        ref.current.active = true;
        if (authenticated)
            void read();
        else
            publish();
        return () => { if (ref.current.epoch === epoch)
            ref.current.active = false; };
    }, [authenticated, epoch, read, publish]);
    const run = useCallback(async <T,>(kind: string, work: () => Promise<T>, reread = true): Promise<T | null> => {
        if (!current() || ref.current.busy)
            return null;
        ref.current.busy = kind;
        ref.current.error = null;
        ref.current.notice = null;
        ref.current.loading = false;
        ++ref.current.read;
        publish();
        try {
            const result = await work();
            if (!current())
                return null;
            if (reread)
                await read(true);
            return current() ? result : null;
        }
        catch (caught) {
            if (current()) {
                ref.current.error = safe(caught);
                publish();
            }
            return null;
        }
        finally {
            if (current()) {
                ref.current.busy = null;
                publish();
            }
        }
    }, [current, publish, read]);
    const vote = useCallback(async (entryId: string) => {
        const s = ref.current;
        if (!current() || !authenticated || s.busy)
            return null;
        if (s.pendingBallot && s.pendingBallot.entryId !== entryId) {
            s.error = 'Retry your original ballot before choosing a different candidate.';
            publish();
            return null;
        }
        if (!s.pendingBallot) {
            const c = s.snapshot?.campaign;
            if (s.loading || s.error || !s.snapshot?.can_participate || !c || c.status !== 'open' || !s.snapshot.candidates.some(e => e.id === entryId)
                || s.snapshot.entry?.id === entryId || s.snapshot.ballot?.invalidated || Date.now() < Date.parse(c.vote_opens_at) || Date.now() >= Date.parse(c.vote_closes_at))
                return null;
            try {
                s.pendingBallot = { campaignId: c.id, entryId, requestId: randomUUID(), version: s.snapshot.ballot?.version ?? 0, uncertain: false, confirmed: false };
            }
            catch {
                s.error = safe(null);
                publish();
                return null;
            }
        }
        const pending = s.pendingBallot;
        return run('vote', async () => {
            try {
                await fanZoneRpc('fun_vote', { p_campaign_id: pending.campaignId, p_entry_id: pending.entryId, p_request_id: pending.requestId, p_expected_version: pending.version });
                if (current()) {
                    pending.confirmed = true;
                    ref.current.notice = 'Ballot request confirmed. Checking your current ballot…';
                }
            }
            catch (caught) {
                if (current()) {
                    pending.uncertain = true;
                    // Explicit server refusal proves no mutation; a fresh read is still needed before a different choice.
                    if (caught instanceof FanZoneError && ['FUN_BALLOT_VERSION_STALE', 'FUN_CANDIDATE_UNAVAILABLE', 'FUN_VOTE_WINDOW_CLOSED', 'FUN_BALLOT_INVALIDATED', 'FUN_BALLOT_RATE_LIMIT'].includes(caught.code)) {
                        pending.confirmed = true;
                        await read(true);
                    }
                }
                throw caught;
            }
            return true;
        });
    }, [authenticated, current, publish, read, run]);
    const uploadDraft = useCallback(async (attempt: Upload) => {
        if (!current())
            throw new FanZoneError('FUN_UNAVAILABLE');
        // An uncertain INSERT may have committed. Verify it first; never overwrite the reserved object.
        if (attempt.stage === 'insert') {
            const uri = await compressHighlight(attempt.draft.uri);
            if (!current())
                return null;
            const body = await bytesFromUri(uri);
            if (!current())
                return null;
            if (!body.byteLength || body.byteLength > FAN_ZONE_MEDIA_LIMITS.maxBytes)
                throw new FanZoneError('FUN_MEDIA_INVALID');
            attempt.stage = 'uncertain';
            await uploadFanZoneVideo(attempt.entry.path, body);
            if (!current())
                return null;
            attempt.stage = 'verify';
        }
        if (!current())
            return null;
        let receipt;
        try {
            receipt = await verifyFanZoneUpload(attempt.entry.id, attempt.entry.revision);
        }
        catch (caught) {
            if (current() && attempt.stage === 'uncertain')
                attempt.stage = 'insert';
            throw caught;
        }
        if (!current())
            return null;
        if (receipt.ok !== true || receipt.revision !== attempt.entry.revision || typeof receipt.digest !== 'string' || !/^[a-f0-9]{64}$/.test(receipt.digest)
            || typeof receipt.bytes !== 'number' || receipt.bytes < 1 || receipt.bytes > FAN_ZONE_MEDIA_LIMITS.maxBytes || typeof receipt.duration_ms !== 'number'
            || receipt.duration_ms < FAN_ZONE_MEDIA_LIMITS.minDurationMs || receipt.duration_ms > FAN_ZONE_MEDIA_LIMITS.maxDurationMs)
            throw new FanZoneError('FUN_INVALID_RESPONSE');
        const next = await fetchFanZone(attempt.entry.campaign_id);
        if (!current())
            return null;
        const e = next.entry;
        if (!e || e.id !== attempt.entry.id || e.revision !== attempt.entry.revision || !e.verified || e.digest !== receipt.digest || e.bytes !== receipt.bytes || e.duration_ms !== receipt.duration_ms)
            throw new FanZoneError('FUN_INVALID_RESPONSE');
        ref.current.snapshot = next;
        ref.current.upload = null;
        ref.current.notice = 'Private video verified. Review the exact permission scope before submitting.';
        publish();
        return e;
    }, [current, publish]);
    const saveDraft = useCallback(async (draft: FanZoneDraft) => {
        const s = ref.current, c = s.snapshot?.campaign;
        if (!current() || !authenticated || s.busy || s.loading || !s.snapshot?.can_participate || !c || c.status !== 'open' || !validDraft(draft))
            return null;
        if (s.upload) {
            s.error = 'Finish or retry your current private upload before replacing the draft.';
            publish();
            return null;
        }
        return run('upload', async () => {
            let e = ref.current.snapshot?.entry ?? null;
            if (!e) {
                e = (await fanZoneRpc('fun_entry', { p_campaign_id: c.id, p_entry_id: null, p_action: 'reserve', p_payload: {} })).entry;
                if (!current())
                    return null;
            }
            // Every replacement, including changed copy, reserves a fresh immutable revision before bytes are inserted.
            e = (await fanZoneRpc('fun_entry', { p_campaign_id: c.id, p_entry_id: e.id, p_action: 'edit', p_payload: { alias: draft.alias, caption: draft.caption, rights_confirmed: draft.rights } })).entry;
            if (!current())
                return null;
            ref.current.snapshot = { ...ref.current.snapshot!, entry: e };
            publish();
            const attempt: Upload = { draft: { ...draft }, entry: e, stage: 'insert' };
            ref.current.upload = attempt;
            return uploadDraft(attempt);
        }, false);
    }, [authenticated, current, publish, run, uploadDraft]);
    const retryUpload = useCallback(() => ref.current.upload ? run('upload', () => uploadDraft(ref.current.upload!), false) : Promise.resolve(null), [run, uploadDraft]);
    const replaceFailedUpload = useCallback(() => { if (current() && !ref.current.busy) {
        ref.current.upload = null;
        ref.current.error = null;
        ref.current.notice = 'Choose a replacement. It will reserve a new private revision.';
        publish();
    } }, [current, publish]);
    const permission = useCallback((e: FanZoneEntry, action: FanZonePermissionAction) => run('permission', async () => {
        try {
            const visible = ref.current.snapshot?.entry?.id === e.id ? ref.current.snapshot.entry : ref.current.snapshot?.guardian_queue.find(row => row.id === e.id);
            if (!authenticated || !visible || !sameScope(e, visible))
                throw new FanZoneError('FUN_PERMISSION_SCOPE_STALE');
            const receipt = await fanZoneRpc('fun_permission', { p_entry_id: e.id, p_revision: e.revision, p_action: action, p_expected_scope: e.consent_scope });
            if (current())
                ref.current.notice = action === 'revoke' ? 'Your permission revoked. Subsequent exposure requires valid current permission.' : 'Exact revision permission recorded. Review and separate teen/guardian permission still apply.';
            return receipt.entry;
        }
        catch (caught) {
            if (current() && caught instanceof FanZoneError && caught.code === 'FUN_PERMISSION_SCOPE_STALE') {
                // Invalidate before reading. An explicit generation also resets review when React batches an equal fresh DTO.
                ref.current.snapshot = null;
                ++ref.current.permissionReviewEpoch;
                publish();
                await read(true);
            }
            throw caught;
        }
    }), [authenticated, current, publish, read, run]);
    const entryAction = useCallback((e: FanZoneEntry, action: 'submit' | 'withdraw') => run(action, async () => {
        if (!authenticated)
            throw new FanZoneError('FUN_ACCOUNT_INELIGIBLE');
        const receipt = await fanZoneRpc('fun_entry', { p_campaign_id: e.campaign_id, p_entry_id: e.id, p_action: action, p_payload: {} });
        if (current())
            ref.current.notice = action === 'withdraw' ? 'Entry withdrawn. Media removal is a separate tracked request.' : 'Private submission received. This does not make it a public candidate.';
        return receipt.entry;
    }), [authenticated, current, run]);
    const concern = useCallback((entryId: string, kind: FanZoneCaseKind, details: string) => run('concern', async () => {
        let request = ref.current.caseRequest;
        if (request && (request.entryId !== entryId || request.kind !== kind || request.details !== details))
            throw new FanZoneError('FUN_CASE_UNAVAILABLE');
        if (!request)
            ref.current.caseRequest = request = { entryId, kind, details, secret: randomUUID() };
        let receipt;
        try {
            receipt = await fanZoneRpc('fun_case', { p_entry_id: request.entryId, p_kind: request.kind, p_details: request.details, p_secret: request.secret });
        }
        catch (caught) {
            if (current() && caught instanceof FanZoneError && ['FUN_CASE_RATE_LIMIT', 'FUN_DELETION_ALREADY_REQUESTED', 'FUN_CASE_UNAVAILABLE', 'FUN_ACCOUNT_INELIGIBLE'].includes(caught.code))
                ref.current.caseRequest = null;
            throw caught;
        }
        if (current()) {
            ref.current.cases = [{ receipt: receipt.case, secret: request.secret }, ...ref.current.cases.filter(c => c.receipt.id !== receipt.case.id)].slice(0, 20);
            ref.current.caseRequest = null;
            ref.current.notice = 'Request received. Save the receipt ID and private secret to check status for 30 days.';
        }
        return receipt.case;
    }, false), [current, run]);
    const caseStatus = useCallback((id: string, secret: string) => run('status', async () => {
        const receipt = await fanZoneRpc('fun_case_status', { p_case_id: id, p_secret: secret });
        if (current())
            ref.current.cases = [{ receipt: receipt.case, secret }, ...ref.current.cases.filter(c => c.receipt.id !== id)].slice(0, 20);
        return receipt.case;
    }, false), [current, run]);
    const removeAll = useCallback((e: FanZoneEntry) => run('removal', async () => {
        const revisions = e.media_revisions.filter(m => m.present).map(m => m.revision);
        if (!revisions.length)
            revisions.push(e.revision);
        const result: FanZoneRemoval = { entryId: e.id, removed: 0, total: revisions.length, completed: false };
        ref.current.removal = result;
        publish();
        try {
            for (const revision of revisions) {
                if (!current())
                    return null;
                const receipt = await removeFanZoneRevision(e.id, revision);
                if (!current())
                    return null;
                result.removed++;
                result.completed = receipt.completed;
                publish();
            }
            ref.current.notice = result.completed ? 'All stored revisions removed. Server completion confirmed.' : 'Removal remains pending. Refresh and retry remaining revisions.';
            return result;
        }
        catch (caught) {
            if (current()) {
                result.completed = false;
                await read(true);
            }
            throw caught;
        }
    }), [current, publish, read, run]);
    const reflection = useCallback((idea: FanZoneReflectionIdea) => run('reflection', async () => {
        const c = ref.current.snapshot?.campaign;
        if (!c || !ref.current.snapshot?.can_participate)
            throw new FanZoneError('FUN_REFLECTION_INVALID');
        const receipt = await fanZoneRpc('fun_reflection', { p_campaign_id: c.id, p_id: null, p_idea: idea, p_action: 'create' });
        if (current())
            ref.current.notice = 'Private reflection received. It adds no votes, money, Aura or public badge.';
        return receipt;
    }), [current, run]);
    const deleteReflection = useCallback((id: string) => run('reflection', async () => {
        const c = ref.current.snapshot?.campaign;
        if (!c)
            throw new FanZoneError('FUN_REFLECTION_UNAVAILABLE');
        const receipt = await fanZoneRpc('fun_reflection', { p_campaign_id: c.id, p_id: id, p_idea: null, p_action: 'delete' });
        if (current())
            ref.current.notice = 'Private reflection deleted.';
        return receipt;
    }), [current, run]);
    const visible = view.epoch === epoch && key !== null;
    return { ...(visible ? view : empty()), loading: auth.loading || (authenticated && (!visible || view.loading)), identityKey: key === null ? null : JSON.stringify([key, epoch]),
        uploadPending: key !== null && !!ref.current.upload, refresh, vote, saveDraft, retryUpload, replaceFailedUpload, permission, submit: (e: FanZoneEntry) => entryAction(e, 'submit'),
        withdraw: (e: FanZoneEntry) => entryAction(e, 'withdraw'), concern, caseStatus, removeAll, reflection, deleteReflection };
}
export type FanZoneState = ReturnType<typeof useFanZone>;

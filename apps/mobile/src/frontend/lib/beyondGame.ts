/** BEYOND-01 exact actor-bound RPC + private Storage boundary. No route or service accesses Supabase directly. */
import { BEYOND_RIGHTS_VERSION, BEYOND_SAFETY_VERSION, parseBeyondAccess, parseBeyondCleanup, parseBeyondExport, parseBeyondIds, parseBeyondPage, parseBeyondPost, parseBeyondStatus, parseAdminBeyondStatus, type BeyondActor, type BeyondCategory, type BeyondPost, type BeyondReserveInput, type BeyondState } from '@tapuai/shared-types/beyondGame';
import { callRpc } from '@/lib/rpc';
import { supabase } from '@/lib/supabase';
import { createClient } from '@supabase/supabase-js';
const limit = (n: number) => Number.isFinite(n) ? Math.max(1, Math.min(50, Math.floor(n))) : 30;
const args = (actor: string | null) => ({ expected_actor_id: actor });
export async function fetchBeyondStatus(actor: string | null) {
    return parseBeyondStatus(await callRpc('beyond_status', args(actor)));
}
export async function fetchBeyondPosts(actor: string | null, category: BeyondCategory | null, maxRows = 30, beforeId: string | null = null) {
    return parseBeyondPage(await callRpc('beyond_posts', { ...args(actor), category, max_rows: limit(maxRows), before_id: beforeId }));
}
export async function fetchMyBeyondPosts(actor: string, maxRows = 30, beforeId: string | null = null) {
    return parseBeyondPage(await callRpc('beyond_my_posts', { ...args(actor), max_rows: limit(maxRows), before_id: beforeId }));
}
export async function reserveBeyondPost(actor: string, input: BeyondReserveInput) {
    return parseBeyondPost(await callRpc('beyond_reserve', { ...args(actor), request_id: input.requestId, category: input.category, caption: input.caption, audience: input.audience, media: input.media, rights_version: BEYOND_RIGHTS_VERSION, safety_version: BEYOND_SAFETY_VERSION }));
}
export async function finalizeBeyondPost(actor: string, postId: string) {
    return parseBeyondPost(await callRpc('beyond_finalize', { ...args(actor), post_id: postId }));
}
export async function removeBeyondPost(actor: string, postId: string) {
    return parseBeyondPost(await callRpc('beyond_remove', { ...args(actor), post_id: postId }));
}
export async function reportBeyondPost(actor: string, postId: string, reason: string) {
    const r = await callRpc<unknown>('beyond_report', { ...args(actor), post_id: postId, reason });
    if (!r || typeof r !== 'object' || !('received' in r) || r.received !== true) {
        throw Error('Your concern could not be confirmed. Refresh.');
    }
    return { received: true };
}
/** Validate actual user AND canonical profile before/after asynchronous private operations. */
export async function assertBeyondActor(actor: BeyondActor) {
    const { data, error } = await supabase.auth.getUser();
    if (error || data.user?.id !== actor.userId) {
        throw Error('Your account changed. Reopen Beyond the Game.');
    }
    const status = await fetchBeyondStatus(actor.profileId);
    if (status.actorId !== actor.profileId) {
        throw Error('Your account changed. Reopen Beyond the Game.');
    }
}
/** A captured token prevents the global auth client borrowing a later account during Storage's async token read. */
async function actorStorage(actor: BeyondActor | null) {
    if (actor) {
        await assertBeyondActor(actor);
    }
    const { data, error } = await supabase.auth.getSession();
    if (error || (actor ? data?.session?.user.id !== actor.userId : !!data?.session)) {
        throw Error('Your account changed. Reopen Beyond the Game.');
    }
    const token = data.session?.access_token ?? null;
    if (actor && !token) {
        throw Error('Your account changed. Reopen Beyond the Game.');
    }
    const url = process.env.EXPO_PUBLIC_SUPABASE_URL, key = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key) {
        throw Error('Private media is not configured.');
    }
    return createClient(url, key, { accessToken: async () => token, auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } }).storage.from('beyond_game');
}
/** No upsert or bucket fallback. Safe retries reuse the server's existing exact matching reserved object. */
export async function uploadReservedBeyondMedia(actor: BeyondActor, post: BeyondPost, mediaId: string, bytes: ArrayBuffer) {
    const media = post.media.find(m => m.id === mediaId);
    if (!media || post.creatorId !== actor.profileId || media.path.split('/')[0] !== actor.userId || bytes.byteLength !== media.bytes || post.status !== 'draft') {
        throw Error('This file does not match its reserved submission.');
    }
    const storage = await actorStorage(actor);
    const { error } = await storage.upload(media.path, bytes, { contentType: media.mime, upsert: false, cacheControl: '0' });
    if (error) {
        try {
            parseBeyondAccess(await callRpc('beyond_media_access', { ...args(actor.profileId), post_id: post.id, media_id: mediaId }), post, mediaId);
        }
        catch {
            throw Error('This file could not be uploaded. Retry the same submission.');
        }
    }
    await assertBeyondActor(actor);
}
/** Caller must clear the result on actor/visibility/unmount changes. The SDK requests60s; arbitrary direct Storage signing has no verified server max. Delivered bytes are not recallable. */
export async function signBeyondMedia(actor: BeyondActor | null, post: BeyondPost, mediaId: string) {
    if (!post.media.some(m => m.id === mediaId) || post.status === 'removed') {
        throw Error('This media is unavailable.');
    }
    const request = { ...args(actor?.profileId ?? null), post_id: post.id, media_id: mediaId };
    const access = parseBeyondAccess(await callRpc('beyond_media_access', request), post, mediaId);
    const storage = await actorStorage(actor);
    const { data, error } = await storage.createSignedUrl(access.path, access.ttlSeconds);
    if (error || !data?.signedUrl) {
        throw Error('This private media could not be loaded.');
    }
    if (actor) {
        await assertBeyondActor(actor);
    }
    else {
        const user = await supabase.auth.getUser();
        if (user.data.user) {
            throw Error('Your account changed. Reopen Beyond the Game.');
        }
    }
    parseBeyondAccess(await callRpc('beyond_media_access', request), post, mediaId);
    return { url: data.signedUrl, expiresAt: Date.now() + 60000 };
}
export async function fetchAdminBeyondStatus(actor: string) {
    return parseAdminBeyondStatus(await callRpc('admin_beyond_status', args(actor)));
}
export async function adminSetBeyondEnabled(actor: string, enabled: boolean, reason: string) {
    return parseAdminBeyondStatus(await callRpc('admin_beyond_set_enabled', { ...args(actor), turn_on: enabled, reason }));
}
export async function fetchAdminBeyondPosts(actor: string, status: BeyondState = 'pending', maxRows = 30, beforeId: string | null = null) {
    return parseBeyondPage(await callRpc('admin_beyond_posts', { ...args(actor), status, max_rows: limit(maxRows), before_id: beforeId }));
}
export async function adminReviewBeyondPost(actor: string, post: BeyondPost, action: 'approve' | 'remove', reason: string) {
    return parseBeyondPost(await callRpc('admin_beyond_review', { ...args(actor), post_id: post.id, expected_revision: post.revision, action, reason }));
}
export async function adminBeyondCleanup(actor: BeyondActor, post: BeyondPost) {
    await assertBeyondActor(actor);
    const raw = await callRpc<unknown>('admin_beyond_cleanup_targets', { ...args(actor.profileId), post_id: post.id });
    if (!raw || typeof raw !== 'object' || !('paths' in raw) || !('post_id' in raw) || raw.post_id !== post.id || !Array.isArray(raw.paths) || raw.paths.length > 3 || raw.paths.some((p: unknown) => typeof p !== 'string' || !post.media.some(m => m.path === p))) {
        throw Error('Cleanup targets changed. Refresh.');
    }
    const storage = await actorStorage(actor);
    let failed = false;
    if (raw.paths.length) {
        const result = await storage.remove(raw.paths as string[]);
        failed = !!result.error;
    }
    await assertBeyondActor(actor);
    const result = parseBeyondCleanup(await callRpc('admin_beyond_cleanup_finish', { ...args(actor.profileId), post_id: post.id }));
    return { ...result, requestFailed: failed };
}
export async function adminBeyondRetention(actor: string, reason: string) {
    return parseBeyondIds(await callRpc('admin_beyond_retention', { ...args(actor), reason }), 'expired_post_ids', 100);
}
export async function exportMyBeyondData(actor: string, section: 'posts' | 'reports' | 'quota', beforeId: string | null = null) {
    return parseBeyondExport(await callRpc('beyond_export_my_data', { ...args(actor), section, max_rows: 50, before_id: beforeId }), section);
}
export async function adminEraseBeyondProfile(actor: string, target: string, reason: string) {
    return parseBeyondIds(await callRpc('admin_beyond_erase_profile', { ...args(actor), target_profile_id: target, reason }), 'removed_post_ids', 50);
}

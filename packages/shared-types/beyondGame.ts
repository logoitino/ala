/** BEYOND-01 bounded RPC projection. No remote reads, media URLs, athlete/payee identity or messages. */
export const BEYOND_CATEGORIES = ['workout', 'service', 'learning', 'story'] as const;
export type BeyondCategory = typeof BEYOND_CATEGORIES[number];
export type BeyondAudience = 'friends' | 'everyone';
export type BeyondState = 'draft' | 'pending' | 'approved' | 'held' | 'removed';
export const BEYOND_RIGHTS_VERSION = 'beyond-rights-1';
export const BEYOND_SAFETY_VERSION = 'beyond-safety-1';
export type BeyondActor = {
    userId: string;
    profileId: string;
};
export type BeyondMediaInput = {
    id: string;
    kind: 'photo' | 'video';
    bytes: number;
    width: number;
    height: number;
    duration_ms?: number;
};
export type BeyondReserveInput = {
    requestId: string;
    category: BeyondCategory;
    caption: string;
    audience: BeyondAudience;
    media: BeyondMediaInput[];
};
export type BeyondMedia = {
    id: string;
    position: number;
    kind: 'photo' | 'video';
    path: string;
    mime: 'image/jpeg' | 'video/mp4';
    bytes: number;
    width: number;
    height: number;
    durationMs: number | null;
};
export type BeyondPost = {
    id: string;
    creatorId: string | null;
    category: BeyondCategory;
    caption: string;
    audience: BeyondAudience;
    status: BeyondState;
    revision: number;
    createdAt: string;
    submittedAt: string | null;
    attestedAt: string;
    rightsVersion: string;
    safetyVersion: string;
    cleanup: 'not_requested' | 'pending' | 'partial' | 'complete';
    media: BeyondMedia[];
    reviewReason: string | null;
    reviewedAt: string | null;
    reportCount: number | null;
};
export type BeyondPage = {
    posts: BeyondPost[];
    nextId: string | null;
    enabled: boolean;
};
export type BeyondStatus = {
    enabled: boolean;
    missing: string[];
    actorId: string | null;
    canSubmit: boolean;
    friendsOnly: boolean;
};
export type AdminBeyondStatus = {
    enabled: boolean;
    missing: string[];
    changedAt: string | null;
    reason: string | null;
    pending: number;
    cleanupPending: number;
};
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const bad = (): never => {
    throw new Error('Beyond the Game returned unavailable data. Refresh before continuing.');
};
const obj = (v: unknown): Record<string, unknown> => v !== null && typeof v === 'object' && !Array.isArray(v) ? v as Record<string, unknown> : bad();
const id = (v: unknown): string => typeof v === 'string' && uuid.test(v) ? v : bad();
const text = (v: unknown, max = 240): string => typeof v === 'string' && Array.from(v).length <= max ? v : bad();
const bool = (v: unknown): boolean => typeof v === 'boolean' ? v : bad();
const int = (v: unknown, min = 0, max = Number.MAX_SAFE_INTEGER): number => typeof v === 'number' && Number.isSafeInteger(v) && v >= min && v <= max ? v : bad();
const date = (v: unknown): string => typeof v === 'string' && v.length <= 40 && Number.isFinite(Date.parse(v)) ? v : bad();
const nullableDate = (v: unknown): string | null => v == null ? null : date(v);
const list = (v: unknown, max: number): unknown[] => Array.isArray(v) && v.length <= max ? v : bad();
const missing = (v: unknown) => list(v, 12).map(x => text(x, 100));
export function parseBeyondPost(input: unknown): BeyondPost {
    const r = obj(input), postId = id(r.id), category = text(r.category) as BeyondCategory, status = text(r.status) as BeyondState, audience = text(r.audience) as BeyondAudience, cleanup = text(r.cleanup) as BeyondPost['cleanup'];
    if (!BEYOND_CATEGORIES.includes(category) || !['draft', 'pending', 'approved', 'held', 'removed'].includes(status) || !['friends', 'everyone'].includes(audience) || !['not_requested', 'pending', 'partial', 'complete'].includes(cleanup)) {
        bad();
    }
    const ms = list(r.media, 3).map((v, index): BeyondMedia => {
        const m = obj(v), mediaId = id(m.id), kind = text(m.kind) as BeyondMedia['kind'], mime = text(m.mime) as BeyondMedia['mime'], path = text(m.path, 130);
        if (kind !== 'photo' && kind !== 'video' || mime !== (kind === 'photo' ? 'image/jpeg' : 'video/mp4') || !new RegExp(`^[0-9a-f-]{36}/${postId}/${mediaId}\\.${kind === 'photo' ? 'jpg' : 'mp4'}$`).test(path)) {
            bad();
        }
        id(path.split('/')[0]);
        return { id: mediaId, position: int(m.position, index, index), kind, path, mime, bytes: int(m.bytes, 1, kind === 'photo' ? 5242880 : 52428800), width: int(m.width, 1, 4096), height: int(m.height, 1, 4096), durationMs: kind === 'photo' ? (m.duration_ms == null ? null : bad()) : int(m.duration_ms, 1, 45000) };
    });
    if (ms.some(m => m.kind === 'video') && (ms.length !== 1 || ms[0].kind !== 'video') || new Set(ms.map(m => m.id)).size !== ms.length || status !== 'removed' && ms.length === 0) {
        bad();
    }
    if (r.rights_version !== BEYOND_RIGHTS_VERSION || r.safety_version !== BEYOND_SAFETY_VERSION) {
        bad();
    }
    return { id: postId, creatorId: r.creator_id == null ? null : id(r.creator_id), category, caption: text(r.caption), audience, status, revision: int(r.revision, 1), createdAt: date(r.created_at), submittedAt: nullableDate(r.submitted_at), attestedAt: date(r.attested_at), rightsVersion: BEYOND_RIGHTS_VERSION, safetyVersion: BEYOND_SAFETY_VERSION, cleanup, media: ms, reviewReason: r.review_reason == null ? null : text(r.review_reason), reviewedAt: nullableDate(r.reviewed_at), reportCount: r.report_count == null ? null : int(r.report_count) };
}
export function parseBeyondPage(input: unknown): BeyondPage {
    const r = obj(input);
    return { posts: list(r.posts, 50).map(parseBeyondPost), nextId: r.next_id == null ? null : id(r.next_id), enabled: bool(r.enabled) };
}
export function parseBeyondStatus(input: unknown): BeyondStatus {
    const r = obj(input);
    return { enabled: bool(r.enabled), missing: missing(r.missing), actorId: r.actor_id == null ? null : id(r.actor_id), canSubmit: bool(r.can_submit), friendsOnly: bool(r.friends_only) };
}
export function parseAdminBeyondStatus(input: unknown): AdminBeyondStatus {
    const r = obj(input);
    return { enabled: bool(r.enabled), missing: missing(r.missing), changedAt: nullableDate(r.changed_at), reason: r.reason == null ? null : text(r.reason), pending: int(r.pending), cleanupPending: int(r.cleanup_pending) };
}
export function parseBeyondAccess(input: unknown, post: BeyondPost, mediaId: string): {
    path: string;
    ttlSeconds: 60;
} {
    const r = obj(input), m = post.media.find(m => m.id === mediaId);
    if (!m) {
        return bad();
    }
    if (r.bucket !== 'beyond_game' || r.post_id !== post.id || r.media_id !== mediaId || r.path !== m.path || r.ttl_seconds !== 60) {
        bad();
    }
    return { path: m.path, ttlSeconds: 60 };
}
export function parseBeyondCleanup(input: unknown): {
    postId: string;
    cleanup: 'partial' | 'complete';
    remaining: number;
} {
    const r = obj(input);
    if (r.cleanup !== 'partial' && r.cleanup !== 'complete' || r.basis !== 'storage_catalog') {
        bad();
    }
    return { postId: id(r.post_id), cleanup: r.cleanup as 'partial' | 'complete', remaining: int(r.remaining, 0, 3) };
}
export function parseBeyondExport(input: unknown, section: 'posts' | 'reports' | 'quota'): {
    items: Record<string, unknown>[] | BeyondPost[];
    nextId: string | null;
} {
    const r = obj(input);
    if (r.section !== section) {
        bad();
    }
    const items = list(r.items, 50);
    return { items: section === 'posts' ? items.map(parseBeyondPost) : items.map(v => {
            const x = obj(v);
            return section === 'quota' ? { id: id(x.id), reserved_at: date(x.reserved_at) } : { id: id(x.id), post_id: id(x.post_id), reason: text(x.reason), created_at: date(x.created_at) };
        }), nextId: r.next_id == null ? null : id(r.next_id) };
}
export function parseBeyondIds(input: unknown, key: 'expired_post_ids' | 'removed_post_ids', max: number): {
    ids: string[];
    more: boolean;
} {
    const r = obj(input);
    return { ids: list(r[key], max).map(id), more: r.more == null ? false : bool(r.more) };
}

import { parseBeyondPost, parseBeyondPage } from '@tapuai/shared-types/beyondGame';
import { fetchBeyondPosts, reserveBeyondPost, signBeyondMedia } from '@/lib/beyondGame';
import { callRpc } from '@/lib/rpc';
import { supabase } from '@/lib/supabase';
jest.mock('@/lib/rpc', () => ({ callRpc: jest.fn() }));
jest.mock('@/lib/supabase', () => ({ isSupabaseConfigured: true, supabase: { auth: { getUser: jest.fn(), getSession: jest.fn() }, storage: { from: jest.fn() } } }));
jest.mock('@supabase/supabase-js', () => ({ createClient: jest.fn(() => ({ storage: require('@/lib/supabase').supabase.storage })) }));
const UID = '00000000-0000-0000-0000-000000000001', PID = '00000000-0000-0000-0000-000000000002', POST = '00000000-0000-0000-0000-000000000003', MID = '00000000-0000-0000-0000-000000000004';
const raw = { id: POST, creator_id: PID, category: 'story', caption: 'Safe story', audience: 'friends', status: 'pending', revision: 2, created_at: '2026-10-16T01:00:00Z', submitted_at: '2026-10-16T01:01:00Z', attested_at: '2026-10-16T01:00:00Z', rights_version: 'beyond-rights-1', safety_version: 'beyond-safety-1', cleanup: 'not_requested', media: [{ id: MID, position: 0, kind: 'photo', path: `${UID}/${POST}/${MID}.jpg`, mime: 'image/jpeg', bytes: 24, width: 1, height: 1, duration_ms: null }] };
const actor = { userId: UID, profileId: PID };
beforeEach(() => {
    jest.clearAllMocks();
    process.env.EXPO_PUBLIC_SUPABASE_URL = 'https://storage.invalid';
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = 'public-test-key';
    (supabase.auth.getSession as jest.Mock).mockResolvedValue({ data: { session: { user: { id: UID }, access_token: 'captured-test-token' } }, error: null });
    (supabase.auth.getUser as jest.Mock).mockResolvedValue({ data: { user: { id: UID } }, error: null });
});
it('rejects external or wrongly scoped media paths rather than displaying them', () => {
    expect(() => parseBeyondPost({ ...raw, media: [{ ...raw.media[0], path: 'https://evil.invalid/p.jpg' }] })).toThrow();
    expect(() => parseBeyondPost({ ...raw, media: [{ ...raw.media[0], path: `${UID}/00000000-0000-0000-0000-000000000009/${MID}.jpg` }] })).toThrow();
});
it('rejects absent queue payload and oversized arrays rather than reporting no content', () => {
    expect(() => parseBeyondPage({})).toThrow();
    expect(() => parseBeyondPage({ posts: Array(51).fill(raw), enabled: true, next_id: null })).toThrow();
});
it('projects exact media and preserves null review status without personal extras', () => {
    expect(parseBeyondPost({ ...raw, unsafe: 'secret' })).not.toHaveProperty('unsafe');
    expect(parseBeyondPost(raw).media[0].durationMs).toBeNull();
});
it('uses expected canonical actor and bounded category read, never direct table access', async () => {
    (callRpc as jest.Mock).mockResolvedValue({ posts: [raw], enabled: true, next_id: null });
    expect((await fetchBeyondPosts(PID, 'story', 999)).posts).toHaveLength(1);
    expect(callRpc).toHaveBeenCalledWith('beyond_posts', { expected_actor_id: PID, category: 'story', max_rows: 50, before_id: null });
});
it('preserves request identity and exact attestation versions in a retry', async () => {
    (callRpc as jest.Mock).mockResolvedValue(raw);
    const input = { requestId: POST, category: 'story' as const, caption: 'Safe story', audience: 'friends' as const, media: [{ id: MID, kind: 'photo' as const, bytes: 24, width: 1, height: 1 }] };
    await reserveBeyondPost(PID, input);
    expect(callRpc).toHaveBeenCalledWith('beyond_reserve', expect.objectContaining({ request_id: POST, rights_version: 'beyond-rights-1', safety_version: 'beyond-safety-1', media: input.media }));
});
it('never returns a signed URL from a departed actor', async () => {
    const createSignedUrl = jest.fn(async () => {
        (supabase.auth.getUser as jest.Mock).mockResolvedValue({ data: { user: { id: 'other' } }, error: null });
        return { data: { signedUrl: 'https://storage.invalid/signed' }, error: null };
    });
    (supabase.storage.from as jest.Mock).mockReturnValue({ createSignedUrl });
    (callRpc as jest.Mock).mockImplementation(async (fn: string) => fn === 'beyond_media_access' ? { bucket: 'beyond_game', path: raw.media[0].path, ttl_seconds: 60, post_id: POST, media_id: MID } : { actor_id: PID, enabled: true, missing: [], can_submit: true, friends_only: false, rights_version: 'beyond-rights-1', safety_version: 'beyond-safety-1' });
    await expect(signBeyondMedia(actor, parseBeyondPost(raw), MID)).rejects.toThrow(/account/i);
    expect(createSignedUrl).toHaveBeenCalledWith(raw.media[0].path, 60);
});
it('refuses a substituted media target before contacting Storage', async () => {
    await expect(signBeyondMedia(actor, parseBeyondPost(raw), '00000000-0000-0000-0000-000000000009')).rejects.toThrow();
    expect(supabase.storage.from).not.toHaveBeenCalled();
});
it('pins Storage authorization to the captured user token even when the global session switches', async () => {
    const { createClient } = require('@supabase/supabase-js');
    let captured: string | null = null;
    const createSignedUrl = jest.fn(async () => {
        (supabase.auth.getSession as jest.Mock).mockResolvedValue({ data: { session: { user: { id: 'later-user' }, access_token: 'later-token' } }, error: null });
        (supabase.auth.getUser as jest.Mock).mockResolvedValue({ data: { user: { id: 'later-user' } }, error: null });
        captured = await createClient.mock.calls[0][2].accessToken();
        return { data: { signedUrl: 'https://storage.invalid/signed' }, error: null };
    });
    (supabase.storage.from as jest.Mock).mockReturnValue({ createSignedUrl });
    (callRpc as jest.Mock).mockImplementation(async (fn: string) => fn === 'beyond_media_access' ? { bucket: 'beyond_game', path: raw.media[0].path, ttl_seconds: 60, post_id: POST, media_id: MID } : { actor_id: PID, enabled: true, missing: [], can_submit: true, friends_only: false });
    await expect(signBeyondMedia(actor, parseBeyondPost(raw), MID)).rejects.toThrow(/account/);
    expect(captured).toBe('captured-test-token');
    expect(createClient.mock.calls[0][2].auth.persistSession).toBe(false);
});
it('preserves a failed cleanup request as partial instead of claiming provider erasure', async () => {
    const { adminBeyondCleanup } = require('@/lib/beyondGame');
    (supabase.storage.from as jest.Mock).mockReturnValue({ remove: jest.fn().mockResolvedValue({ error: { message: 'provider unavailable' } }) });
    (callRpc as jest.Mock).mockImplementation(async (fn: string) => fn === 'admin_beyond_cleanup_targets' ? { post_id: POST, paths: [raw.media[0].path] } : fn === 'admin_beyond_cleanup_finish' ? { post_id: POST, cleanup: 'partial', remaining: 1, basis: 'storage_catalog' } : { actor_id: PID, enabled: false, missing: [], can_submit: false, friends_only: false });
    expect(await adminBeyondCleanup(actor, parseBeyondPost({ ...raw, status: 'removed', cleanup: 'pending' }))).toEqual({ postId: POST, cleanup: 'partial', remaining: 1, requestFailed: true });
});
it('refuses substituted cleanup objects before issuing a Storage delete', async () => {
    const { adminBeyondCleanup } = require('@/lib/beyondGame');
    (callRpc as jest.Mock).mockImplementation(async (fn: string) => fn === 'admin_beyond_cleanup_targets' ? { post_id: POST, paths: ['another/object.jpg'] } : { actor_id: PID, enabled: false, missing: [], can_submit: false, friends_only: false });
    await expect(adminBeyondCleanup(actor, parseBeyondPost({ ...raw, status: 'removed', cleanup: 'pending' }))).rejects.toThrow();
    expect(supabase.storage.from).not.toHaveBeenCalled();
});

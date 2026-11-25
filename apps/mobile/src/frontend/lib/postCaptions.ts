/** Caption writes are actor-bound, validated and never queued or automatically retried. */
import { parseBeyondPost, type BeyondPost } from '@tapuai/shared-types/beyondGame';
import { isMissingFunction } from '@/lib/dbErrors';
import { assertCurrent, createOfflineActorClient, isOfflineActorChanged, type OfflineActor } from '@/lib/offlineActor';
import { untypedRpc } from '@/lib/rpc';

type CaptionActor = OfflineActor & { readonly profileId: string };
type ReelCaptionChange = { id: string; owner: string; previous: string; caption: string };
type ReelCaptionRow = { id: string; title: string; uploaded_by?: string | null; is_removed?: boolean | null; is_flagged?: boolean | null };

const subscribers = new Set<(change: ReelCaptionChange) => void>();

/** Only currently mounted feeds receive confirmed edits to rows they already have. */
export function subscribeReelCaptionChanges(apply: (change: ReelCaptionChange) => void) {
  subscribers.add(apply);
  return () => { subscribers.delete(apply); };
}

/** A receipt may update only the matching previously-read row, never replace a newer local title. */
export function applyReelCaptionChange<T extends ReelCaptionRow>(rows: T[], change: ReelCaptionChange): T[] {
  const index = rows.findIndex(row => row.id === change.id && row.uploaded_by === change.owner
    && row.title === change.previous && row.is_removed !== true && row.is_flagged !== true);
  if (index < 0) return rows;
  return rows.map((row, i) => i === index ? { ...row, title: change.caption } : row);
}

/** Replay only receipts confirmed during this read. Callers close on completion or invalidation. */
export function trackReelCaptionRead() {
  const changes: ReelCaptionChange[] = [];
  const stop = subscribeReelCaptionChanges(change => { changes.push(change); });
  return {
    reconcile<T extends ReelCaptionRow>(rows: T[]): T[] {
      for (const change of changes) rows = applyReelCaptionChange(rows, change);
      return rows;
    },
    close() {
      stop();
      changes.length = 0;
    },
  };
}

const unconfirmed = 'Could not confirm the save. Your draft is still here. Refresh the post before editing again.';
const invalid = (limit: number) => `Enter a description of 1 to ${limit} characters.`;

function checkedCaption(value: string, limit: number) {
  const caption = value.trim();
  if (!caption || Array.from(caption).length > limit) throw new Error(invalid(limit));
  return caption;
}

async function writeCaption(actor: CaptionActor, fn: string, params: Record<string, unknown>, limit: number) {
  const accountChanged = 'Your account changed. Reopen the editor.';
  if (!actor.profileId) throw new Error(accountChanged);
  let reply: Awaited<ReturnType<typeof untypedRpc>>;
  try {
    const client = await createOfflineActorClient(actor);
    assertCurrent(actor);
    reply = await untypedRpc(fn, { expected_actor_id: actor.profileId, ...params }, client);
    assertCurrent(actor);
  } catch (error) {
    throw new Error(isOfflineActorChanged(error) || !actor.isCurrent() ? accountChanged : unconfirmed);
  }
  if (!reply.error) return reply.data;
  if (isOfflineActorChanged(reply.error)) throw new Error(accountChanged);
  if (isMissingFunction(reply.error)) throw new Error('Description editing is not available yet. Your draft is still here.');
  switch (reply.error.code) {
    case '40001': throw new Error('This post changed. Refresh and reopen the editor.');
    case '22023': throw new Error(invalid(limit));
    case '42501': throw new Error('You can no longer edit this post. Your draft is still here.');
    default: throw new Error(unconfirmed);
  }
}

/**
 * @purpose Replace only the uploader's exact current Highlight caption.
 * @sideEffects Calls edit_reel_caption and publishes the confirmed result to mounted reel lists.
 */
export async function saveReelDescription(actor: CaptionActor, reelId: string, previous: string, value: string) {
  const caption = checkedCaption(value, 120);
  const result = await writeCaption(actor, 'edit_reel_caption', {
    reel_id: reelId, expected_caption: previous, new_caption: caption,
  }, 120);
  assertCurrent(actor);
  if (!result || typeof result !== 'object' || !('id' in result) || !('caption' in result)
    || result.id !== reelId || result.caption !== caption) throw new Error(unconfirmed);
  const change = { id: reelId, owner: actor.profileId, previous, caption };
  for (const apply of subscribers) apply(change);
  return caption;
}

/** @purpose Confirm only the matching Beyond row and revision, with unchanged non-caption content. */
export async function saveBeyondDescription(actor: CaptionActor, post: BeyondPost, value: string): Promise<BeyondPost> {
  const caption = checkedCaption(value, 240);
  if (post.creatorId !== actor.profileId || !['approved', 'pending'].includes(post.status)) {
    throw new Error('You can no longer edit this post. Your draft is still here.');
  }
  const raw = await writeCaption(actor, 'beyond_edit_caption', {
    post_id: post.id, expected_revision: post.revision, new_caption: caption,
  }, 240);
  assertCurrent(actor);
  let confirmed: BeyondPost;
  try { confirmed = parseBeyondPost(raw); } catch { throw new Error(unconfirmed); }
  const changed = caption !== post.caption;
  if (confirmed.id !== post.id || confirmed.creatorId !== actor.profileId || confirmed.caption !== caption
    || confirmed.revision !== post.revision + Number(changed) || confirmed.status !== (changed ? 'pending' : post.status)
    || confirmed.category !== post.category || confirmed.audience !== post.audience || confirmed.createdAt !== post.createdAt
    || confirmed.submittedAt !== post.submittedAt || confirmed.attestedAt !== post.attestedAt
    || confirmed.rightsVersion !== post.rightsVersion || confirmed.safetyVersion !== post.safetyVersion
    || confirmed.cleanup !== post.cleanup || confirmed.coachLevel !== post.coachLevel
    || JSON.stringify(confirmed.media) !== JSON.stringify(post.media)) throw new Error(unconfirmed);
  return confirmed;
}

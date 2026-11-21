/** Replay existing queued mutations with one captured actor client; no service reaches the backend directly. */
import type { OfflineActionPayload } from '@/services/OfflineQueue';
import { parseReportReason } from '@/data/contentRights';
import { DOUBLE_TAP_AURA_POINTS } from '@/data/highlights';
import { addUserAura } from '@/lib/aura';
import { castCheerVote } from '@/lib/cheerPoll';
import { createOfflineActorClient, type OfflineActor, OfflineActorChangedError } from '@/lib/offlineActor';
import { isReelUuid, reportReelRemote } from '@/lib/reels';
import { sendReelHype, withdrawReelHype } from '@/lib/reelVotes';
import { removeReelBookmark, saveReelBookmark } from '@/lib/savedReels';

/**
 * @purpose Replay one existing action using its actor's captured JWT, including older-database fallbacks.
 * @param actor Current account-lifetime handle; token never enters queue storage.
 * @sideEffects Existing bookmark, hype, cheer, report and Aura RPC/table mutations; unchanged RLS applies.
 */
export async function dispatchOfflineAction(action: OfflineActionPayload, actor: OfflineActor): Promise<void> {
  if (action.type !== 'cheer_vote' && !isReelUuid(action.reelId)) return;
  // A bookmark's explicit row owner must agree with the originating actor, never the incoming session.
  if (action.type === 'bookmark' && action.userId !== actor.userId) throw new OfflineActorChangedError();
  const client = await createOfflineActorClient(actor);
  if (action.type === 'bookmark') {
    const { error } = action.saved
      ? await saveReelBookmark(action.userId, action.reelId, client)
      : await removeReelBookmark(action.userId, action.reelId, client);
    if (error) throw error;
  } else if (action.type === 'cheer_vote') {
    const { error } = await castCheerVote({ slug: action.slug, side: action.side, previousSide: action.previousSide, homeName: action.homeName, awayName: action.awayName }, client);
    if (error) throw error;
  } else if (action.type === 'hype_clear') {
    const { error } = await withdrawReelHype(action.reelId, action.kind, client);
    if (error) throw error;
  } else if (action.type === 'aura_hype') {
    const { error } = await sendReelHype(action.reelId, action.kind, client);
    if (error) throw error;
    // A completed first RPC does not authorize a second request after an account transition.
    if (!actor.isCurrent()) throw new OfflineActorChangedError();
    if (action.grantAura && action.userId) await addUserAura(action.userId, action.auraPoints ?? DOUBLE_TAP_AURA_POINTS, client);
  } else {
    await reportReelRemote(action.reelId, parseReportReason(action.reason), client);
  }
}

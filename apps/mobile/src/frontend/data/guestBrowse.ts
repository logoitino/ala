/**
 * How far a guest may look before the account sheet. A shared Highlight counts as the first look.
 * Upload, Donate, and Join Crew stay closed until there is an account.
 */

/** The clip they opened, plus two more swipes, then the account sheet. */
export const GUEST_FREE_HIGHLIGHTS = 3;

/**
 * @purpose Decide when a guest has looked past the free Highlights.
 * @param distinctClipsSeen How many different clips have been the active page.
 * @returns True once the free looks are used up.
 */
export function guestBrowseNeedsAccount(distinctClipsSeen: number): boolean {
  return distinctClipsSeen > GUEST_FREE_HIGHLIGHTS;
}

export type GuestDesktopPlayDecision =
  | { allow: true; nextAllowedClipId: string | null }
  | { allow: false };

/**
 * @purpose Apply the same three-Highlight guest limit to desktop card opens (WEB-DESKTOP card feed).
 * @param seen Distinct clip ids already opened this guest session (mutated when a new id is allowed in).
 * @param clipId Clip the guest wants to open.
 * @param allowedClipId Last free clip id (mirrors phone `guestAllowedIndex`).
 * @returns Whether playback may open, and the updated allowed clip when still inside the free set.
 */
export function decideGuestDesktopPlay(
  seen: Set<string>,
  clipId: string,
  allowedClipId: string | null,
): GuestDesktopPlayDecision {
  seen.add(clipId);
  if (!guestBrowseNeedsAccount(seen.size)) {
    return { allow: true, nextAllowedClipId: clipId };
  }
  if (clipId === allowedClipId) {
    return { allow: true, nextAllowedClipId: allowedClipId };
  }
  return { allow: false };
}

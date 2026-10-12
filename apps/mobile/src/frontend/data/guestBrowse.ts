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

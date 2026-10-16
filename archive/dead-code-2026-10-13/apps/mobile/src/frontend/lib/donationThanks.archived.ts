// ARCHIVED 2026-10-13 · DATA-01-F6 · owner approved · excerpt from apps/mobile/src/frontend/lib/donationThanks.ts: fetchMyDonationThanks.
// Not built, tested or imported. Restore: move the code back to that path, drop ".archived" from the name, import it.
// Every archived item and its reason: docs/engineering/data-ownership.json → archived.

/**
 * @purpose Thank-yous the signed-in donor has received (Activity).
 */
export async function fetchMyDonationThanks(): Promise<ThanksReceived[]> {
  return (await fetchMyDonationThanksResult()).rows;
}


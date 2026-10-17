/** M8 share lines. A filled Rally and a board leader become a message the fan can send.
 * No new table. Boards stay ranked by hype and views, never by donations.
 */

/** @purpose The message on a filled Rally. The gift link is included when the athlete has a public handle. */
export function rallyShareMessage(title: string, athleteName: string, giftUrl?: string | null): string {
  const name = athleteName.trim() || 'This athlete';
  const goal = title.trim() || 'this Rally';
  const link = giftUrl?.trim() ? ` ${giftUrl.trim()}` : '';
  return `${name}'s community filled ${goal}. Donate. Elevate. Celebrate.${link}`;
}

/** @purpose The message when a board has a leader. The metric is hype or views, never money. */
export function boardShareMessage(board: string, leader: string): string {
  const name = leader.trim() || 'An athlete';
  return `${name} leads ${board} this week. Hype and views only. Donate. Elevate. Celebrate.`;
}

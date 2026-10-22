/** Filled Rally and board-leader share lines. No gift amounts. */
import { boardShareMessage, rallyShareMessage } from '@/lib/shareCard';

describe('share cards', () => {
  it('names the filled Rally and the gift link', () => {
    expect(rallyShareMessage('New cleats', 'Mele', 'https://tapuai.app/gift/mele')).toBe(
      "Mele's community filled New cleats. Give. Elevate. Celebrate. https://tapuai.app/gift/mele",
    );
  });

  it('names a board leader without a money amount', () => {
    expect(boardShareMessage('Most hyped', 'Mele')).toMatch(/Mele leads Most hyped/);
    expect(boardShareMessage('Most hyped', 'Mele')).not.toMatch(/\$/);
  });
});

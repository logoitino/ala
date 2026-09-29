import { isSekiHighlight, pinFeedOrder, rankHomeFeed } from '@/data/highlights';

type Row = { clip: { id: string; athleteName: string; sekiCount: number; auraCount: number; flexCount: number } };

const row = (id: string, sekiCount: number): Row => ({
  clip: { id, athleteName: id, sekiCount, auraCount: 0, flexCount: 0 },
});

describe('pinFeedOrder', () => {
  it('keeps the ranked order when an un-Seki would have re-ranked the clip (regression: feed jumped under the finger)', () => {
    const before = [row('b', 2), row('a', 3), row('c', 0)];
    const order = rankHomeFeed(before as never, { crewIds: new Set() }).map((item) => item.clip.id);
    expect(order).toEqual(['a', 'b', 'c']);

    // Un-Seki on "a": re-ranking would drop it below "b" and, on the Seki pill, remove it outright.
    const after = [row('b', 2), row('a', 2), row('c', 0)];
    expect(rankHomeFeed(after as never, { crewIds: new Set() }).map((item) => item.clip.id)).not.toEqual(order);
    expect(isSekiHighlight(after[1].clip)).toBe(false);

    const pinned = pinFeedOrder(order, after);
    expect(pinned.map((item) => item.clip.id)).toEqual(['a', 'b', 'c']);
    expect(pinned[0].clip.sekiCount).toBe(2);
    expect(pinned[0]).toBe(after[1]);
  });

  it('drops ids that are no longer in the list', () => {
    expect(pinFeedOrder(['x', 'a'], [row('a', 0)]).map((item) => item.clip.id)).toEqual(['a']);
  });
});

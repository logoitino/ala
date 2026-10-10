/** One Seki, Aura, and Flex on a live play, including a clear and a second select that does not credit again. */
import { emptyPlayVotes, togglePlayVote } from '@/lib/playVotes';

describe('togglePlayVote', () => {
  it('gives one of each kind and never stacks a second point', () => {
    let votes = emptyPlayVotes();
    const seki = togglePlayVote(votes, 'seki');
    expect(seki.count).toBe(1);
    expect(seki.credit).toBe(true);
    votes = seki.next;

    const again = togglePlayVote(votes, 'seki');
    expect(again.count).toBe(0);
    expect(again.credit).toBe(false);
    expect(again.next.selected.seki).toBe(false);
    expect(again.next.credited.seki).toBe(true);

    const back = togglePlayVote(again.next, 'seki');
    expect(back.count).toBe(1);
    expect(back.credit).toBe(false);

    const aura = togglePlayVote(back.next, 'aura');
    const flex = togglePlayVote(aura.next, 'flex');
    expect(flex.next.selected).toEqual({ seki: true, aura: true, flex: true });
    expect(flex.next.credited.aura).toBe(true);
    expect(flex.next.credited.flex).toBe(true);
    expect(togglePlayVote(flex.next, 'flex').count).toBe(0);
  });
});

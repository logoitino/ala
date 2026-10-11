/** Seki stays quiet until a play is a story. Flex tells a story as soon as someone rides along. */

import { hypeStories } from '@/data/hypeStory';

describe('hypeStories', () => {
  it('stays quiet until Seki makes the pill or someone flexes', () => {
    expect(hypeStories({ athleteName: 'Sione Tui', sekiCount: 2, flexCount: 2 })).toEqual([]);
  });

  it('lets a personal Seki mean awesome play before the pill', () => {
    expect(hypeStories({ athleteName: 'Sione Tui', sekiCount: 1, flexCount: 0, calledIt: true })).toEqual([
      { id: 'seki', emoji: '🤙', line: 'Awesome play', detail: 'Your Seki' },
    ]);
  });

  it('says you called it once the play is on the Seki pill', () => {
    expect(
      hypeStories({ athleteName: 'Sione Tui', sekiCount: 3, flexCount: 0, calledIt: true })[0],
    ).toMatchObject({ line: 'You called it', detail: 'Seki play' });
  });

  it('tells the crowd it is a Seki play when this person has not tapped', () => {
    expect(hypeStories({ athleteName: 'Sione Tui', sekiCount: 4, flexCount: 0 })[0]).toMatchObject({
      line: 'Seki play',
      detail: '4 called it awesome',
    });
  });

  it('puts the fan on the athlete’s side the moment they flex', () => {
    expect(hypeStories({ athleteName: 'Sione Tui', sekiCount: 0, flexCount: 1, riding: true })[0]).toMatchObject({
      id: 'flex',
      line: 'Riding with Sione',
      detail: "That's your athlete",
    });
  });

  it('shows the crew once three people are riding along', () => {
    expect(hypeStories({ athleteName: 'Sione Tui', sekiCount: 0, flexCount: 3 })[0]).toMatchObject({
      line: '3 riding with Sione',
      detail: 'On their side',
    });
  });
});

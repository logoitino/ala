/**
 * Story lines for Seki and Flex. Seki becomes a story when a play makes the Seki pill.
 * Flex becomes a story as soon as someone rides with that athlete. Aura stays a count and a tier.
 */

import { SEKI_PILL_COUNT } from '@/data/highlights';

/** Flex taps that turn a personal ride into a crowd riding with the athlete. */
export const FLEX_CREW_COUNT = 3;

export type HypeStory = {
  id: 'seki' | 'flex';
  emoji: string;
  line: string;
  detail: string;
};

function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] || 'them';
}

/**
 * @purpose The Seki and Flex lines worth showing on a clip or a profile.
 * @param athleteName Person the play is about.
 * @param sekiCount Seki on this clip, or the athlete's peak.
 * @param flexCount Flex on this clip, or the athlete's peak.
 * @param sekiPlay Clip was marked for the Seki pill even before the count.
 * @param calledIt This person already gave Seki.
 * @param riding This person already gave Flex.
 * @returns Seki first, then Flex. Empty when neither moment has happened.
 */
export function hypeStories(input: {
  athleteName: string;
  sekiCount: number;
  flexCount: number;
  sekiPlay?: boolean;
  calledIt?: boolean;
  riding?: boolean;
}): HypeStory[] {
  const stories: HypeStory[] = [];
  const onSekiPill = Boolean(input.sekiPlay) || input.sekiCount >= SEKI_PILL_COUNT;
  const who = firstName(input.athleteName);

  if (onSekiPill) {
    stories.push(
      input.calledIt
        ? { id: 'seki', emoji: '🤙', line: 'You called it', detail: 'Seki play' }
        : {
            id: 'seki',
            emoji: '🤙',
            line: 'Seki play',
            detail: input.sekiCount >= SEKI_PILL_COUNT ? `${input.sekiCount} called it awesome` : 'Awesome play',
          },
    );
  } else if (input.calledIt) {
    stories.push({ id: 'seki', emoji: '🤙', line: 'Awesome play', detail: 'Your Seki' });
  }

  if (input.riding) {
    stories.push({
      id: 'flex',
      emoji: '💪',
      line: `Riding with ${who}`,
      detail: input.flexCount >= FLEX_CREW_COUNT ? `${input.flexCount} on their side` : "That's your athlete",
    });
  } else if (input.flexCount >= FLEX_CREW_COUNT) {
    stories.push({
      id: 'flex',
      emoji: '💪',
      line: `${input.flexCount} riding with ${who}`,
      detail: 'On their side',
    });
  }

  return stories;
}

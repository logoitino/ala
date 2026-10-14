// ARCHIVED 2026-10-13 · DATA-01-F6 · owner approved · excerpt from apps/mobile/src/frontend/data/exclusive.ts: EXCLUSIVE_KIND_LABEL, EXCLUSIVE_POSTS, EXCLUSIVE_SUBSCRIBE_LABEL, EXCLUSIVE_UNLOCK_TOAST, EXCLUSIVE_VAULT_CALLOUT, VAULT_UNLOCK_LABEL.
// Not built, tested or imported. Restore: move the code back to that path, drop ".archived" from the name, import it.
// Every archived item and its reason: docs/engineering/data-ownership.json → archived.

export const EXCLUSIVE_KIND_LABEL: Record<ExclusivePost['kind'], string> = {
  workout: 'Workout clip',
  pregame: 'Pregame routine',
  qna: 'Fan Q&A',
};

export const EXCLUSIVE_POSTS: ExclusivePost[] = [
  {
    id: 'ex-1',
    kind: 'workout',
    title: 'Film-room footwork',
    blurb: '10-minute ladder, release drills, and pocket reset.',
  },
  {
    id: 'ex-2',
    kind: 'pregame',
    title: 'Pregame walk-up',
    blurb: 'Headphones on, stadium empty, same stretch every Friday.',
  },
  {
    id: 'ex-3',
    kind: 'qna',
    title: 'Fan Q&A: Friday nerves',
    blurb: 'Answering locker-room questions from the hub.',
  },
  {
    id: 'ex-4',
    kind: 'workout',
    title: 'Track start & burst',
    blurb: 'Three reps of 10-yard bursts between series.',
  },
];

export const EXCLUSIVE_SUBSCRIBE_LABEL = exclusiveSubscribeLabel();

export const EXCLUSIVE_UNLOCK_TOAST = exclusiveUnlockToast();

export const EXCLUSIVE_VAULT_CALLOUT = exclusiveVaultCallout();

export const VAULT_UNLOCK_LABEL = vaultUnlockLabel();


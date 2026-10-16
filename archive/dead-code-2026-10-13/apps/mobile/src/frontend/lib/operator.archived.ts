// ARCHIVED 2026-10-13 · DATA-01-F6 · owner approved · excerpt from apps/mobile/src/frontend/lib/operator.ts: OPERATOR_ACTIONS, OPERATOR_CALLOUT_TYPES, OPERATOR_SCORE_STEPS, isOperatorCallout.
// Not built, tested or imported. Restore: move the code back to that path, drop ".archived" from the name, import it.
// Every archived item and its reason: docs/engineering/data-ownership.json → archived.

export const OPERATOR_ACTIONS: OperatorAction[] = [
  { id: 'td', label: 'Touchdown +6', eventType: 'Touchdown', points: 6 },
  { id: 'fg', label: 'Field Goal +3', eventType: 'Field Goal', points: 3 },
  { id: 'xp', label: 'Extra Point +1', eventType: 'Extra Point', points: 1 },
  { id: 'safety', label: '+2 Safety / Conv', eventType: 'Safety', points: 2 },
  { id: 'tackle', label: 'Big Tackle', eventType: 'Tackle', points: 0 },
  { id: 'int', label: 'Interception', eventType: 'Interception', points: 0 },
];

export const OPERATOR_SCORE_STEPS = [
  { points: 1, label: '+1', hint: 'Try' },
  { points: 3, label: '+3', hint: 'Field Goal' },
  { points: 6, label: '+6', hint: 'Touchdown' },
] as const;

export function isOperatorCallout(eventType: string): boolean {
  return OPERATOR_CALLOUT_TYPES.includes(eventType);
}

export const OPERATOR_CALLOUT_TYPES = OPERATOR_CALLOUTS.map((item) => item.eventType);


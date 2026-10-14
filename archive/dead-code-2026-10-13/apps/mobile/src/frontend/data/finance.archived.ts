// ARCHIVED 2026-10-13 · DATA-01-F6 · owner approved · excerpt from apps/mobile/src/frontend/data/finance.ts: splitLabelForSource.
// Not built, tested or imported. Restore: move the code back to that path, drop ".archived" from the name, import it.
// Every archived item and its reason: docs/engineering/data-ownership.json → archived.

export function splitLabelForSource(source: RevenueSource): string {
  if (source === 'malo') return '10% platform / 90% athlete';
  if (source === 'booster') return '15% platform / 85% operator';
  if (source === 'vault') return '20% platform / 80% athlete';
  if (source === 'tip') return '100% platform (donor chose it)';
  return '100% platform';
}


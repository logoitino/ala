// ARCHIVED 2026-10-13 · DATA-01-F6 · owner approved · excerpt from packages/shared-types/admin/reports.ts: maloChannel.
// Not built, tested or imported. Restore: move the code back to that path, drop ".archived" from the name, import it.
// Every archived item and its reason: docs/engineering/data-ownership.json → archived.

export function maloChannel(origin: string, entry: string, sourceLabel: string): string {
  const via = entry === 'qr_link' && origin !== 'qr' ? ' via QR' : '';
  const detail = sourceLabel.trim() ? ` · ${sourceLabel.trim()}` : '';
  return `${maloOriginTitle(origin)}${via}${detail}`;
}


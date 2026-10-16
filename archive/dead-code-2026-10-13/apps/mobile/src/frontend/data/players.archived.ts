// ARCHIVED 2026-10-13 · DATA-01-F6 · owner approved · excerpt from apps/mobile/src/frontend/data/players.ts: emptyReactionCounts, formatGameStatus, formatQuarterClock, formatTipTotal (with their private helpers).
// Not built, tested or imported. Restore: move the code back to that path, drop ".archived" from the name, import it.
// Every archived item and its reason: docs/engineering/data-ownership.json → archived.

export function emptyReactionCounts(): Record<PlayReactionId, number> {
  return { aura: 0, flex: 0, seki: 0 };
}

export function formatGameStatus(
  gameOrStatus: string | { status?: string | null; quarter?: string | null },
): string {
  if (typeof gameOrStatus === 'string') {
    return formatQuarterTag(gameOrStatus);
  }

  const status = (gameOrStatus.status ?? '').trim();
  const quarter = (gameOrStatus.quarter ?? '').trim();
  if (status.toLowerCase() === 'final' || quarter.toLowerCase() === 'final') return 'FINAL';
  if (status.toLowerCase() === 'halftime' || quarter.toLowerCase() === 'halftime') {
    return 'HALFTIME';
  }
  return formatQuarterTag(quarter || status);
}

export function formatQuarterClock(
  game: { status?: string | null; quarter?: string | null; clock?: string | null },
  remainingSeconds?: number,
): string {
  const quarter = getQuarterCode(game);
  if (quarter === 'FINAL' || quarter === 'HALFTIME') return quarter;
  const seconds = remainingSeconds ?? parseClockToSeconds(game.clock) ?? 4 * 60 + 15;
  return `${quarter} ${formatClock(seconds)}`;
}

export function formatTipTotal(amount: number, includeFee: boolean, feeAmount = FEE_AMOUNT): string {
  const fee = includeFee ? feeAmount : 0;
  const total = amount + fee;
  return `Total: $${total.toFixed(2)} ($${amount.toFixed(2)} donation + $${fee.toFixed(2)} fee)`;
}

// Private helpers used only by the code archived above (second pass).
function formatQuarterTag(value: string): string {
  const normalized = value.trim();
  if (!normalized) return 'LIVE';
  if (normalized.toLowerCase() === 'final') return 'FINAL';
  if (normalized.toLowerCase() === 'halftime') return 'HALFTIME';
  if (normalized.toLowerCase() === 'live') return 'LIVE';
  if (normalized.toUpperCase().startsWith('LIVE')) return normalized.toUpperCase();
  return `LIVE ${normalized.toUpperCase()}`;
}

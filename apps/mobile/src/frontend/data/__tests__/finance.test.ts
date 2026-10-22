/** The no-cut gift rate is independent of optional tips; other commercial streams stay unchanged. */
import { platformBpsForSource, type RevenueSource } from '@/data/finance';

describe('platformBpsForSource', () => {
  it('returns the basis points for each source, and merch for anything else', () => {
    expect(platformBpsForSource('malo')).toBe(0);
    expect(platformBpsForSource('booster')).toBe(1500);
    expect(platformBpsForSource('vault')).toBe(2000);
    expect(platformBpsForSource('tip')).toBe(10000);
    expect(platformBpsForSource('merch')).toBe(10000);
    expect(platformBpsForSource('other' as RevenueSource)).toBe(10000);
  });
});

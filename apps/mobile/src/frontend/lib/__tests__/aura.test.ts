import { auraBadgeLabel, auraProgressTowardNext, auraTierForPoints, AURA_TIERS, resolveAuraPoints } from '@/lib/aura';

describe('auraTierForPoints', () => {
  it('returns Tier 1 (Slate Silver) at zero points', () => {
    const tier = auraTierForPoints(0);
    expect(tier.tier).toBe(1);
    expect(tier.title).toBe('Slate Silver');
  });

  it('returns the highest tier whose minimum the balance meets', () => {
    expect(auraTierForPoints(7).tier).toBe(1);
    expect(auraTierForPoints(8).tier).toBe(2);
    expect(auraTierForPoints(19).tier).toBe(2);
    expect(auraTierForPoints(20).tier).toBe(3);
  });

  it('caps at Tier 7 (Celestial Prism) for very large balances', () => {
    const tier = auraTierForPoints(1_000_000);
    expect(tier.tier).toBe(7);
    expect(tier.title).toBe('Celestial Prism');
  });

  it('never goes below Tier 1 for negative input', () => {
    expect(auraTierForPoints(-50).tier).toBe(1);
  });

  it('every tier is reachable in ascending min order (no gaps in the ladder)', () => {
    const mins = AURA_TIERS.map((t) => t.min);
    const sorted = [...mins].sort((a, b) => a - b);
    expect(mins).toEqual(sorted);
  });
});

describe('auraProgressTowardNext', () => {
  it('reports 0 ratio right at a tier boundary', () => {
    const { ratio, tier, next } = auraProgressTowardNext(8);
    expect(tier.tier).toBe(2);
    expect(next?.tier).toBe(3);
    expect(ratio).toBe(0);
  });

  it('reports ratio 1 (capped) at the max tier with no next tier', () => {
    const { ratio, next } = auraProgressTowardNext(999);
    expect(next).toBeNull();
    expect(ratio).toBe(1);
  });

  it('ratio is clamped between 0 and 1', () => {
    const { ratio } = auraProgressTowardNext(0);
    expect(ratio).toBeGreaterThanOrEqual(0);
    expect(ratio).toBeLessThanOrEqual(1);
  });
});

describe('auraBadgeLabel', () => {
  it('formats as "Tier N • Title"', () => {
    const tier = auraTierForPoints(0);
    expect(auraBadgeLabel(tier)).toBe('Tier 1 • Slate Silver');
  });
});

describe('resolveAuraPoints', () => {
  it('prefers aura_points when it is a finite number', () => {
    expect(resolveAuraPoints({ aura_points: 42, aura_count: 1, seki_count: 1, flex_count: 1 })).toBe(42);
  });

  it('falls back to summed hype counts when aura_points is missing', () => {
    expect(resolveAuraPoints({ aura_points: undefined, aura_count: 3, seki_count: 2, flex_count: 1 })).toBe(6);
  });

  it('never returns a negative number', () => {
    expect(resolveAuraPoints({ aura_points: -10, aura_count: 0, seki_count: 0, flex_count: 0 })).toBe(0);
  });
});

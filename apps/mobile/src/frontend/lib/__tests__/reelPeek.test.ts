import { clampPeekOffset, PEEK_FLING_VELOCITY, peekPanelWidth, resolvePeekSnap } from '@/lib/reels';

const WIDTH = 400;

describe('resolvePeekSnap', () => {
  it('stays closed on a short drag with no fling', () => {
    expect(resolvePeekSnap(-40, 0, WIDTH, 0)).toBe(0);
    expect(resolvePeekSnap(40, 0, WIDTH, 0)).toBe(0);
  });

  it('opens from the right when the fan swipes left past the threshold', () => {
    expect(resolvePeekSnap(-WIDTH * 0.3, 0, WIDTH, 0)).toBe(-1);
  });

  it('opens from the left when the fan swipes right past the threshold', () => {
    expect(resolvePeekSnap(WIDTH * 0.3, 0, WIDTH, 0)).toBe(1);
  });

  it('opens on a fast fling even when the drag is short', () => {
    expect(resolvePeekSnap(-20, -PEEK_FLING_VELOCITY, WIDTH, 0)).toBe(-1);
    expect(resolvePeekSnap(20, PEEK_FLING_VELOCITY, WIDTH, 0)).toBe(1);
  });

  it('closes an open panel on the opposite drag and never flips to the other side', () => {
    expect(resolvePeekSnap(WIDTH * 0.2, 0, WIDTH, -1)).toBe(0);
    expect(resolvePeekSnap(WIDTH * 0.9, 0, WIDTH, -1)).toBe(0);
    expect(resolvePeekSnap(-WIDTH * 0.2, 0, WIDTH, 1)).toBe(0);
  });

  it('keeps an open panel open when the drag goes further into it', () => {
    expect(resolvePeekSnap(-60, 0, WIDTH, -1)).toBe(-1);
    expect(resolvePeekSnap(60, 0, WIDTH, 1)).toBe(1);
  });

  it('keeps an open panel open on a small drag back', () => {
    expect(resolvePeekSnap(WIDTH * 0.1, 0, WIDTH, -1)).toBe(-1);
  });
});

describe('peekPanelWidth', () => {
  it('stays inside a phone and caps on a wide browser', () => {
    expect(peekPanelWidth(0)).toBe(0);
    expect(peekPanelWidth(320)).toBe(269);
    expect(peekPanelWidth(390)).toBe(328);
    expect(peekPanelWidth(1200)).toBe(420);
  });

  it('always leaves a strip to close the panel', () => {
    expect(320 - peekPanelWidth(320)).toBeGreaterThanOrEqual(40);
    expect(1200 - peekPanelWidth(1200)).toBeGreaterThanOrEqual(40);
  });
});

describe('clampPeekOffset', () => {
  it('tracks the finger inside the panel width', () => {
    expect(clampPeekOffset(0, -100, 320)).toBe(-100);
    expect(clampPeekOffset(-320, 120, 320)).toBe(-200);
  });

  it('rubber-bands past the panel width', () => {
    const over = clampPeekOffset(0, -420, 320);
    expect(over).toBeLessThan(-320);
    expect(over).toBeGreaterThan(-420);
    expect(clampPeekOffset(0, 420, 320)).toBeCloseTo(320 + 100 * 0.18);
  });
});

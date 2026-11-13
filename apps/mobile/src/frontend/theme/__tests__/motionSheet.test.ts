/**
 * Fan sheet timing tokens stay consistent for TipSheet / Profile menu / Soft-Wall.
 */
import { Easing } from 'react-native-reanimated';

import {
  SHEET_BACKDROP_IN_MS,
  SHEET_BACKDROP_OUT_MS,
  SHEET_CLOSE_TIMING,
  SHEET_DISMISS_MS,
  SHEET_REDUCED_MS,
  SHEET_TRAVEL,
  SPRING_SHEET,
} from '@/theme/motion';

describe('fan sheet motion tokens', () => {
  it('exports a settled sheet spring (no SPRING_CARD bounce)', () => {
    expect(SPRING_SHEET.damping).toBeGreaterThan(20);
    expect(SPRING_SHEET.stiffness).toBeGreaterThan(200);
  });

  it('keeps dismiss slower than reduced-motion and backdrop out shorter than dismiss', () => {
    expect(SHEET_TRAVEL).toBeGreaterThan(300);
    expect(SHEET_DISMISS_MS).toBe(220);
    expect(SHEET_REDUCED_MS).toBeLessThan(SHEET_DISMISS_MS);
    expect(SHEET_BACKDROP_OUT_MS).toBeLessThanOrEqual(SHEET_DISMISS_MS);
    expect(SHEET_BACKDROP_IN_MS).toBe(200);
    expect(SHEET_CLOSE_TIMING.duration).toBe(SHEET_DISMISS_MS);
    expect(SHEET_CLOSE_TIMING.easing).toBe(Easing.in(Easing.cubic));
  });
});

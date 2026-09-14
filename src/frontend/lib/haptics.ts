import * as Haptics from 'expo-haptics';

export type PressHaptic = 'light' | 'medium' | 'selection' | 'none';

/**
 * @purpose Tap feedback for every real button. Maps to `Haptics.impactAsync(Light)` unless `none`.
 * @param kind `none` skips. `medium` / `selection` are aliases of Light (audit standard).
 * @sideEffects Native haptics; no-ops on web / simulator when the engine is missing.
 */
export function impactPress(kind: PressHaptic = 'light') {
  if (kind === 'none') return;
  try {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  } catch {
    // Web / simulator may not expose a haptics engine.
  }
}

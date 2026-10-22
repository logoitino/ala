/** Live Reduce Transparency for the fan dock; unknown/native unsupported stays solid.
 * Web reads its matching browser preference because RN web has no native transparency API.
 * @sideEffects AccessibilityInfo device read/listener, or browser media preference subscription.
 */
import { useEffect, useState } from 'react';
import { AccessibilityInfo, Platform } from 'react-native';

/** @purpose Keep decorative dock transparency responsive to the person's live accessibility preference. */
export function useReduceTransparency(): boolean {
  const [reduce, setReduce] = useState(true);
  useEffect(() => {
    if (Platform.OS === 'web' && typeof window !== 'undefined' && window.matchMedia) {
      const preference = window.matchMedia('(prefers-reduced-transparency: reduce)');
      setReduce(preference.matches);
      const update = (event: MediaQueryListEvent) => setReduce(event.matches);
      preference.addEventListener('change', update);
      return () => preference.removeEventListener('change', update);
    }
    let live = true;
    let changed = false;
    const subscription = AccessibilityInfo.addEventListener?.('reduceTransparencyChanged', value => {
      changed = true;
      if (live) setReduce(value === true);
    });
    Promise.resolve(AccessibilityInfo.isReduceTransparencyEnabled?.())
      .then(value => { if (live && !changed) setReduce(value !== false); })
      .catch(() => { if (live && !changed) setReduce(true); });
    return () => { live = false; subscription?.remove?.(); };
  }, []);
  return reduce;
}

import { useMemo } from 'react';

import { paletteFromTheme, type ThemeColors } from '@/constants/theme';
import { useAppRuntime } from '@/context/AppRuntimeContext';

/**
 * @purpose Live Look-desk palette for shells that should follow Daylight (default) or a published night preset.
 * @returns Full `ThemeColors` derived from `app_runtime_config.published.theme`.
 */
export function usePalette(): ThemeColors {
  const { live } = useAppRuntime();
  return useMemo(() => paletteFromTheme(live.theme), [live.theme]);
}

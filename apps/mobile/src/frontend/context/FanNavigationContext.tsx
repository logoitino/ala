/** Fan-tab presentation state and actual floating-dock clearance are local memory only.
 * Stable scroll/measurement actions avoid needless screen renders; role screens reserve no fan footer.
 * UX-18's initial44pt surface estimate is replaced by actual font/safe-area layout reporting.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { usePathname } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { createFanNavigationScroll } from '@/lib/fanNavigationScroll';

const inert = { sample: (_offset: number) => {}, restore: () => {}, reset: () => {}, dispose: () => {} };
const FanScrollContext = createContext(inert);
const FanBackdropContext = createContext(false);
const FanDockHeightContext = createContext(0);
const FanDockMeasureContext = createContext((_height: number) => {});

/** @purpose Bind scroll direction and stop recovery to the fan navigation lifetime. */
export function FanNavigationProvider({ children }: { children: ReactNode }) {
  const insets = useSafeAreaInsets();
  const [measuredHeight, setMeasuredHeight] = useState<number | null>(null);
  // Before the first dock layout, reserve its compact control height plus the safe foot.
  const dockHeight = measuredHeight ?? 44 + Math.max(insets.bottom, 6);
  const measureDock = useCallback((height: number) => {
    if (!Number.isFinite(height) || height <= 0) return;
    setMeasuredHeight((current) => current !== null && Math.abs(current - height) < 0.5 ? current : height);
  }, []);
  const [softened, setSoftened] = useState(false);
  const scroll = useMemo(() => createFanNavigationScroll(setSoftened), []);
  const pathname = usePathname();
  useEffect(() => { scroll.reset(); }, [pathname, scroll]);
  useEffect(() => () => scroll.dispose(), [scroll]);
  return (
    <FanScrollContext.Provider value={scroll}>
      <FanBackdropContext.Provider value={softened}>
        <FanDockMeasureContext.Provider value={measureDock}>
          <FanDockHeightContext.Provider value={dockHeight}>{children}</FanDockHeightContext.Provider>
        </FanDockMeasureContext.Provider>
      </FanBackdropContext.Provider>
    </FanScrollContext.Provider>
  );
}

/** @purpose Stable in-memory scroll actions; safe no-op for role screens outside the fan provider. */
export function useFanNavigation() { return useContext(FanScrollContext); }
/** @purpose Subscribe only the dock to backdrop changes. */
export function useFanDockSoftened() { return useContext(FanBackdropContext); }
/** @purpose Actual dock wrap height, including safe foot and wrapped labels; zero outside fan tabs. */
export function useFanDockHeight(): number { return useContext(FanDockHeightContext); }
/** @purpose Stable layout reporter used by the dock alone. */
export function useMeasureFanDock() { return useContext(FanDockMeasureContext); }

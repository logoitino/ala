/** Fan-tab presentation state is local memory only. Stable scroll actions do not rerender every screen.
 * Outside fan tabs the context is inert; route changes cancel old scroll/idle work.
 */
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { usePathname } from 'expo-router';
import { createFanNavigationScroll } from '@/lib/fanNavigationScroll';

const inert = { sample: (_offset: number) => {}, restore: () => {}, reset: () => {}, dispose: () => {} };
const FanScrollContext = createContext(inert);
const FanBackdropContext = createContext(false);

/** @purpose Bind scroll direction and stop recovery to the fan navigation lifetime. */
export function FanNavigationProvider({ children }: { children: ReactNode }) {
  const [softened, setSoftened] = useState(false);
  const scroll = useMemo(() => createFanNavigationScroll(setSoftened), []);
  const pathname = usePathname();
  useEffect(() => { scroll.reset(); }, [pathname, scroll]);
  useEffect(() => () => scroll.dispose(), [scroll]);
  return (
    <FanScrollContext.Provider value={scroll}>
      <FanBackdropContext.Provider value={softened}>{children}</FanBackdropContext.Provider>
    </FanScrollContext.Provider>
  );
}

/** @purpose Stable in-memory scroll actions; safe no-op for role screens outside the fan provider. */
export function useFanNavigation() { return useContext(FanScrollContext); }
/** @purpose Subscribe only the dock to backdrop changes. */
export function useFanDockSoftened() { return useContext(FanBackdropContext); }

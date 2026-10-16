/**
 * Global upload sheet state. ＋ asks "Highlight or Beyond moment?" only while Beyond contributions are switched on;
 * otherwise it opens the Highlight composer straight away, exactly as before (owner 2026-10-16).
 */
import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';
import { router } from 'expo-router';

import { useAppRuntime } from '@/context/AppRuntimeContext';
import { useAuth } from '@/context/AuthContext';
import { useSoftWall } from '@/context/SoftWallContext';
import type { Reel } from '@/types/database';

type UploadedListener = (reel: Reel) => void;

type UploadSheetContextValue = {
  visible: boolean;
  /** The Highlight-or-Beyond chooser is showing. */
  chooserVisible: boolean;
  lastUploaded: Reel | null;
  /** ＋ entry point: the chooser when Beyond posting is on, else the Highlight composer. */
  openUpload: () => void;
  /** Skip the chooser and open the Highlight composer. */
  openHighlightUpload: () => void;
  /** Close the chooser and open the reviewed Beyond the Game composer. */
  openBeyondComposer: () => void;
  closeChooser: () => void;
  closeUpload: () => void;
  notifyUploaded: (reel: Reel) => void;
  subscribeUploaded: (listener: UploadedListener) => () => void;
};

const UploadSheetContext = createContext<UploadSheetContextValue | null>(null);

/**
 * @purpose Fan-bar Upload FAB sheet, its Highlight-or-Beyond chooser, and a bus so Highlights ⚡ feed and
 * `/user/[id]` pick up new clips instantly.
 * @returns Visibility controls, `lastUploaded`, and `subscribeUploaded`.
 * @sideEffects In-memory listeners; Beyond choice navigates to `/beyond?compose=1`. Guests get the account sheet first.
 */
export function UploadSheetProvider({ children }: { children: ReactNode }) {
  const { isGuest } = useAuth();
  const { requireAuth } = useSoftWall();
  const { live } = useAppRuntime();
  const beyondChoice = live.tabs.beyond && live.highlights.beyondGameEnabled;
  const [visible, setVisible] = useState(false);
  const [chooserVisible, setChooserVisible] = useState(false);
  const [lastUploaded, setLastUploaded] = useState<Reel | null>(null);
  const listeners = useRef(new Set<UploadedListener>());

  const start = useCallback(() => {
    if (beyondChoice) setChooserVisible(true);
    else setVisible(true);
  }, [beyondChoice]);
  const openUpload = useCallback(() => {
    if (isGuest) {
      requireAuth({
        kind: 'upload',
        resume: start,
      });
      return;
    }
    start();
  }, [isGuest, requireAuth, start]);
  const openHighlightUpload = useCallback(() => {
    setChooserVisible(false);
    setVisible(true);
  }, []);
  const openBeyondComposer = useCallback(() => {
    setChooserVisible(false);
    router.push('/beyond?compose=1');
  }, []);
  const closeChooser = useCallback(() => setChooserVisible(false), []);
  const closeUpload = useCallback(() => setVisible(false), []);

  const subscribeUploaded = useCallback((listener: UploadedListener) => {
    listeners.current.add(listener);
    return () => {
      listeners.current.delete(listener);
    };
  }, []);

  const notifyUploaded = useCallback((reel: Reel) => {
    setLastUploaded(reel);
    listeners.current.forEach((listener) => listener(reel));
  }, []);

  const value = useMemo(
    () => ({
      visible,
      chooserVisible,
      lastUploaded,
      openUpload,
      openHighlightUpload,
      openBeyondComposer,
      closeChooser,
      closeUpload,
      notifyUploaded,
      subscribeUploaded,
    }),
    [chooserVisible, closeChooser, closeUpload, lastUploaded, notifyUploaded, openBeyondComposer, openHighlightUpload, openUpload, subscribeUploaded, visible],
  );

  return <UploadSheetContext.Provider value={value}>{children}</UploadSheetContext.Provider>;
}

export function useUploadSheet() {
  const value = useContext(UploadSheetContext);
  if (!value) {
    throw new Error('useUploadSheet must be used within UploadSheetProvider.');
  }
  return value;
}

export function useOptionalUploadSheet(): UploadSheetContextValue | null {
  return useContext(UploadSheetContext);
}

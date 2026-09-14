import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';

import type { Reel } from '@/types/database';

type UploadedListener = (reel: Reel) => void;

type UploadSheetContextValue = {
  visible: boolean;
  lastUploaded: Reel | null;
  openUpload: () => void;
  closeUpload: () => void;
  notifyUploaded: (reel: Reel) => void;
  subscribeUploaded: (listener: UploadedListener) => () => void;
};

const UploadSheetContext = createContext<UploadSheetContextValue | null>(null);

/**
 * @purpose Fan-bar Upload FAB sheet plus a bus so Highlights ⚡ feed and `/user/[id]` pick up new clips instantly.
 * @returns Visibility controls, `lastUploaded`, and `subscribeUploaded`.
 * @sideEffects In-memory listeners; no network.
 */
export function UploadSheetProvider({ children }: { children: ReactNode }) {
  const [visible, setVisible] = useState(false);
  const [lastUploaded, setLastUploaded] = useState<Reel | null>(null);
  const listeners = useRef(new Set<UploadedListener>());

  const openUpload = useCallback(() => setVisible(true), []);
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
    () => ({ visible, lastUploaded, openUpload, closeUpload, notifyUploaded, subscribeUploaded }),
    [visible, lastUploaded, openUpload, closeUpload, notifyUploaded, subscribeUploaded],
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

import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';

import { useAuth } from '@/context/AuthContext';
import { useSoftWall } from '@/context/SoftWallContext';
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
 * @sideEffects In-memory listeners. Guests get the account sheet instead of the composer.
 */
export function UploadSheetProvider({ children }: { children: ReactNode }) {
  const { isGuest } = useAuth();
  const { requireAuth } = useSoftWall();
  const [visible, setVisible] = useState(false);
  const [lastUploaded, setLastUploaded] = useState<Reel | null>(null);
  const listeners = useRef(new Set<UploadedListener>());

  const openUpload = useCallback(() => {
    if (isGuest) {
      requireAuth({
        kind: 'upload',
        resume: () => setVisible(true),
      });
      return;
    }
    setVisible(true);
  }, [isGuest, requireAuth]);
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
    [closeUpload, lastUploaded, notifyUploaded, openUpload, subscribeUploaded, visible],
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

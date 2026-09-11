import { useCallback, useContext, createContext, type ReactNode, useMemo, useState } from 'react';

export type CelebrationPayload = {
  playerName: string;
  backerCount: number;
};

type CelebrationContextValue = {
  payload: CelebrationPayload | null;
  celebrate: (payload: CelebrationPayload) => void;
  dismiss: () => void;
};

const CelebrationContext = createContext<CelebrationContextValue | null>(null);

export function CelebrationProvider({ children }: { children: ReactNode }) {
  const [payload, setPayload] = useState<CelebrationPayload | null>(null);

  const celebrate = useCallback((next: CelebrationPayload) => {
    setPayload(next);
  }, []);

  const dismiss = useCallback(() => {
    setPayload(null);
  }, []);

  const value = useMemo(
    () => ({ payload, celebrate, dismiss }),
    [celebrate, dismiss, payload],
  );

  return <CelebrationContext.Provider value={value}>{children}</CelebrationContext.Provider>;
}

export function useCelebration(): CelebrationContextValue {
  const context = useContext(CelebrationContext);
  if (!context) {
    throw new Error('useCelebration must be used within CelebrationProvider');
  }
  return context;
}

export function useOptionalCelebration(): CelebrationContextValue | null {
  return useContext(CelebrationContext);
}

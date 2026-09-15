import { useCallback, useContext, createContext, type ReactNode, useMemo, useState } from 'react';

export type CelebrationPayload = {
  playerName: string;
  backerCount: number;
  auraPointsEarned?: number;
};

export type AuraToastPayload = {
  points: number;
  message?: string;
};

type CelebrationContextValue = {
  payload: CelebrationPayload | null;
  auraToast: AuraToastPayload | null;
  celebrate: (payload: CelebrationPayload) => void;
  celebrateAura: (points: number, message?: string) => void;
  showToast: (message: string) => void;
  dismiss: () => void;
  dismissAura: () => void;
};

const CelebrationContext = createContext<CelebrationContextValue | null>(null);

/**
 * @purpose Mālo "YOU BACKED" overlay plus Aura / exclusive-unlock toast.
 * @returns Context with `celebrate` (Mālo modal), `celebrateAura`, and `showToast` (custom banner).
 * @sideEffects In-memory overlay state only; AuraToast auto-dismisses.
 */
export function CelebrationProvider({ children }: { children: ReactNode }) {
  const [payload, setPayload] = useState<CelebrationPayload | null>(null);
  const [auraToast, setAuraToast] = useState<AuraToastPayload | null>(null);

  const celebrate = useCallback((next: CelebrationPayload) => {
    setPayload(next);
    if (next.auraPointsEarned && next.auraPointsEarned > 0) {
      setAuraToast({ points: next.auraPointsEarned });
    }
  }, []);

  const celebrateAura = useCallback((points: number, message?: string) => {
    if (points <= 0 && !message) return;
    setAuraToast({ points, message });
  }, []);

  const showToast = useCallback((message: string) => {
    const next = message.trim();
    if (!next) return;
    setAuraToast({ points: 0, message: next });
  }, []);

  const dismiss = useCallback(() => {
    setPayload(null);
  }, []);

  const dismissAura = useCallback(() => {
    setAuraToast(null);
  }, []);

  const value = useMemo(
    () => ({ payload, auraToast, celebrate, celebrateAura, showToast, dismiss, dismissAura }),
    [auraToast, celebrate, celebrateAura, dismiss, dismissAura, payload, showToast],
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

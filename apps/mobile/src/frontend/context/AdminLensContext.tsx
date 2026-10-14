import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { ADMIN_LENS_KEY, type AdminLens } from '@/lib/admin';

type AdminLensContextValue = {
  lens: AdminLens;
  setLens: (next: AdminLens) => void;
};

const AdminLensContext = createContext<AdminLensContextValue | null>(null);

function asLens(value: string | null): AdminLens {
  if (value === 'marketing' || value === 'owner' || value === 'engineer' || value === 'finance' || value === 'all') return value;
  return 'all';
}

/**
 * @purpose Persist Marketing / Owner / Engineer / Finance / All desks filter for the admin sidebar.
 * @sideEffects AsyncStorage `tapuai.adminLens`.
 */
export function AdminLensProvider({ children }: { children: ReactNode }) {
  const [lens, setLensState] = useState<AdminLens>('all');

  useEffect(() => {
    void AsyncStorage.getItem(ADMIN_LENS_KEY).then((raw) => {
      setLensState(asLens(raw));
    });
  }, []);

  const setLens = useCallback((next: AdminLens) => {
    setLensState(next);
    void AsyncStorage.setItem(ADMIN_LENS_KEY, next);
  }, []);

  const value = useMemo(() => ({ lens, setLens }), [lens, setLens]);
  return <AdminLensContext.Provider value={value}>{children}</AdminLensContext.Provider>;
}

export function useAdminLens(): AdminLensContextValue {
  const context = useContext(AdminLensContext);
  if (!context) {
    throw new Error('useAdminLens must be used within AdminLensProvider');
  }
  return context;
}

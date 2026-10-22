/** Write forms use confirmed stored sport choices; decorative starter playbooks never authorize new selections. */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { activeSportNames, type SportConfig } from '@/data/sports';
import { fetchStoredSportConfigs } from '@/lib/sports';
const alwaysCurrent = () => true;
type Status = 'loading' | 'ready' | 'unavailable';
/** @purpose Bind authoritative active sport choices to the current account and modal visit. */
export function useStoredSportChoices(enabled = true) {
  const { user, isSessionCurrent = alwaysCurrent } = useAuth();
  const account = user?.id ?? null;
  const visit = useRef({ enabled, generation: 0 });
  if (visit.current.enabled !== enabled) visit.current = { enabled, generation: visit.current.generation + 1 };
  const generation = visit.current.generation;
  const requestRef = useRef(0);
  const [request, setRequest] = useState(0);
  const reload = useCallback(() => { requestRef.current += 1; setRequest(requestRef.current); }, []);
  const [state, setState] = useState<{ account: string | null; guard: () => boolean; generation: number; request: number; configs: SportConfig[]; status: Status } | null>(null);
  useEffect(() => {
    let current = true;
    if (!enabled) return () => { current = false; };
    setState(null);
    const validDelivery = () => current && visit.current.generation === generation && requestRef.current === request && isSessionCurrent();
    void fetchStoredSportConfigs().then(configs => {
      if (validDelivery()) setState({ account, guard: isSessionCurrent, generation, request, configs: configs ?? [], status: configs === null ? 'unavailable' : 'ready' });
    }, () => { if (validDelivery()) setState({ account, guard: isSessionCurrent, generation, request, configs: [], status: 'unavailable' }); });
    return () => { current = false; };
  }, [account, enabled, generation, request, isSessionCurrent]);
  const valid = enabled && state?.account === account && state.guard === isSessionCurrent && state.generation === generation && state.request === requestRef.current && isSessionCurrent();
  const configs = valid ? state.configs : null;
  const sportNames = useMemo(() => configs ? activeSportNames(configs) : [], [configs]);
  return { sportNames, status: valid ? state.status : 'loading' as Status, reload };
}

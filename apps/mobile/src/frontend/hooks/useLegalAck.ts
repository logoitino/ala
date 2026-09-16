import { useCallback, useEffect, useState } from 'react';

import { useAuth } from '@/context/AuthContext';
import { hasLegalAck, recordLegalAck } from '@/lib/legal';
import { telemetry } from '@/services/TelemetryManager';

/**
 * @purpose Load and persist Terms / NIL / minor-safety acknowledgement for Profile, Athlete Verification, and Connect.
 * @returns `accepted` (current version), `ready`, `accept()`, and `refresh()`.
 * @sideEffects `hasLegalAck` / `recordLegalAck` (AsyncStorage + optional `profiles` UPDATE); telemetry `legal_ack`.
 */
export function useLegalAck() {
  const { session, profile, refreshProfile } = useAuth();
  const userId = session?.user.id ?? null;
  const [accepted, setAccepted] = useState(false);
  const [ready, setReady] = useState(false);

  const refresh = useCallback(async () => {
    const ok = await hasLegalAck(userId, profile?.legal_terms_accepted_at, profile?.legal_terms_version);
    setAccepted(ok);
    setReady(true);
    return ok;
  }, [profile?.legal_terms_accepted_at, profile?.legal_terms_version, userId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const accept = useCallback(async () => {
    await recordLegalAck(userId);
    setAccepted(true);
    telemetry.trackFeature('legal_ack', 'profile');
    if (userId) await refreshProfile();
  }, [refreshProfile, userId]);

  return { accepted, ready, accept, refresh, userId };
}

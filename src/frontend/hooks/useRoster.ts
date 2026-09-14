import { useCallback, useEffect, useState } from 'react';

import { subscribePlayerAura } from '@/lib/aura';
import { hydratePlayerHype, type PlayerHype } from '@/lib/hype';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';
import type { Player } from '@/types/database';

const CONFIG_ERROR =
  'Add EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY to .env.local, then restart Expo.';

/**
 * @purpose Live roster for tagging, Mālo, and the athlete sheet (`players` including `vault_locked`).
 * @returns `{ players, loading, error, refresh, applyBackerCount, applyHype, applyAuraPoints, applyVaultLocked, setPlayers }`.
 * @sideEffects `players` SELECT; `hydratePlayerHype`; Aura Realtime.
 */
export function useRoster() {
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);

    if (!isSupabaseConfigured) {
      setPlayers([]);
      setError(CONFIG_ERROR);
      setLoading(false);
      return;
    }

    const { data, error: queryError } = await supabase.from('players').select('*');
    if (queryError) {
      setPlayers([]);
      setError(queryError.message);
      setLoading(false);
      return;
    }

    const rows = (data as Player[] | null) ?? [];
    const hydrated = await Promise.all(rows.map((player) => hydratePlayerHype(player)));
    setPlayers(hydrated);
    setLoading(false);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const applyBackerCount = useCallback((playerId: string, nextCount: number) => {
    setPlayers((current) =>
      current.map((player) =>
        player.id === playerId ? { ...player, backer_count: nextCount } : player,
      ),
    );
  }, []);

  const applyHype = useCallback((playerId: string, hype: PlayerHype) => {
    setPlayers((current) =>
      current.map((player) => (player.id === playerId ? { ...player, ...hype } : player)),
    );
  }, []);

  const applyAuraPoints = useCallback((playerId: string, auraPoints: number) => {
    setPlayers((current) =>
      current.map((player) => (player.id === playerId ? { ...player, aura_points: auraPoints } : player)),
    );
  }, []);

  const applyVaultLocked = useCallback((playerId: string, vaultLocked: boolean) => {
    setPlayers((current) =>
      current.map((player) => (player.id === playerId ? { ...player, vault_locked: vaultLocked } : player)),
    );
  }, []);

  useEffect(() => subscribePlayerAura(applyAuraPoints), [applyAuraPoints]);

  return { players, loading, error, refresh, applyBackerCount, applyHype, applyAuraPoints, applyVaultLocked, setPlayers };
}

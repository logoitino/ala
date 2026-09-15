import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';

import { evaluateTrainingBadges, type TrainingBadgeView } from '@tapuai/shared-types';

import { fetchAthleteTrainingBadges, type AthleteTrainingBadgeState } from '@/lib/trainingBadges';

const EMPTY: AthleteTrainingBadgeState = {
  playerId: null,
  confirmedTags: 0,
  maloCents: 0,
  rosterClaimed: false,
  unlocks: [],
  badges: evaluateTrainingBadges({
    playerId: null,
    confirmedTags: 0,
    maloCents: 0,
    rosterClaimed: false,
  }),
};

/**
 * @purpose Athlete HQ training badges: locked vs unlocked from confirmed tags, Mālo received, and roster claim.
 * @param playerId Claimed `profiles.player_id`. Null keeps every chip locked with earn rules visible.
 * @returns `{ badges, rosterClaimed, confirmedTags, maloCents, loading, refresh }`.
 * @sideEffects `sync_athlete_training_badges` on focus (table fallback if the RPC is not applied yet).
 */
export function useAthleteTrainingBadges(playerId: string | null | undefined) {
  const [state, setState] = useState<AthleteTrainingBadgeState>(EMPTY);
  const [loading, setLoading] = useState(Boolean(playerId));

  const refresh = useCallback(async () => {
    setLoading(Boolean(playerId));
    const next = await fetchAthleteTrainingBadges(playerId);
    setState(next);
    setLoading(false);
  }, [playerId]);

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );

  return {
    badges: state.badges as TrainingBadgeView[],
    rosterClaimed: state.rosterClaimed,
    confirmedTags: state.confirmedTags,
    maloCents: state.maloCents,
    loading,
    refresh,
  };
}

import { useEffect, useState } from 'react';

import type { SchoolTeam } from '@/data/teams';
import { searchSchoolsAndTeams } from '@/lib/teams';

const DEBOUNCE_MS = 180;

/**
 * @purpose Debounced fuzzy search of `public.schools_and_teams` for Athlete onboarding.
 * @param query Live TextInput value from the unified team picker.
 * @returns `{ teams, loading }` — High School and NCAA rows with level badges.
 * @sideEffects `search_schools_and_teams` / table ILIKE after 180ms.
 */
export function useTeamSearch(query: string) {
  const [teams, setTeams] = useState<SchoolTeam[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const needle = query.trim();
    if (needle.length < 1) {
      setTeams([]);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    const timer = setTimeout(() => {
      void searchSchoolsAndTeams(needle)
        .then((rows) => {
          if (!cancelled) setTeams(rows);
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    }, DEBOUNCE_MS);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query]);

  return { teams, loading };
}

import type { Href } from 'expo-router';

import { colors } from '@/constants/theme';

export const roleStackOptions = {
  headerStyle: { backgroundColor: colors.surface },
  headerShadowVisible: false,
  headerTintColor: colors.accent,
  headerTitleStyle: { fontWeight: '700' as const, color: colors.text },
  contentStyle: { backgroundColor: colors.background },
};

/**
 * @purpose Local-tab match href so the fan bar stays mounted (`(guest)/game/[id]` hides it).
 * @param gameId `games.id`.
 * @returns `/local/game/{id}` inside the Local nested stack.
 */
export function localGameHref(gameId: string): Href {
  return `/local/game/${gameId}` as Href;
}

/**
 * @purpose Public athlete sheet inside the fan tabs (`FanTabBar` stays visible).
 * @param playerId `players.id`.
 * @returns `/user/{id}`.
 */
export function userProfileHref(playerId: string): Href {
  return `/user/${playerId}` as Href;
}

/**
 * Device-local list of favorited athletes (AsyncStorage key `tapuai.favoritePlayerIds`).
 * Never leaves the phone. Used by the Profile tab and the guest game page. Bad or missing data reads as an empty list.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'tapuai.favoritePlayerIds';

export async function loadFavoritePlayerIds(): Promise<string[]> {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed.filter((id) => typeof id === 'string') : [];
  } catch {
    return [];
  }
}

export async function saveFavoritePlayerIds(ids: string[]): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
}

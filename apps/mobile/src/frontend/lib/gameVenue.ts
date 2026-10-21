/**
 * LOCAL-02: build an external directions request for the chosen public game venue.
 * No geolocation, geocoding, API key or fan origin is read. Map apps own their routing choices.
 * @sideEffects openGameDirections delegates an explicitly requested HTTPS URL to Expo Linking.
 */
import { Platform } from 'react-native';
import * as Linking from 'expo-linking';

/** @purpose Encode only a valid public destination; never use a school name as an inferred address. */
export function gameDirectionsUrl(address: string | null | undefined, platform: string): string | null {
  const destination = address?.trim();
  if (!destination || Array.from(destination).length > 320) return null;
  try {
    const encoded = encodeURIComponent(destination);
    return platform === 'ios'
      ? `https://maps.apple.com/?daddr=${encoded}`
      : `https://www.google.com/maps/dir/?api=1&destination=${encoded}`;
  } catch {
    // A malformed Unicode value must not crash the game screen or become a broken external URL.
    return null;
  }
}

/** @purpose Open directions only after a fan requests them; propagate failures so the visible address remains usable. */
export async function openGameDirections(address: string): Promise<void> {
  const url = gameDirectionsUrl(address, Platform.OS);
  if (!url) throw new Error('Venue address unavailable.');
  await Linking.openURL(url);
}

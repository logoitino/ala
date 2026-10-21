/** LOCAL-02: destinations must use the selected public address, encode query text safely and launch only on request. */
import { gameDirectionsUrl, openGameDirections } from '@/lib/gameVenue';
import { Platform } from 'react-native';
import * as Linking from 'expo-linking';
jest.mock('expo-linking', () => ({ openURL: jest.fn() }));

beforeEach(() => jest.clearAllMocks());

it.each([
  ['ios', 'https://maps.apple.com/?daddr=12%20Main%20St%2C%20Honolulu%2C%20HI'],
  ['android', 'https://www.google.com/maps/dir/?api=1&destination=12%20Main%20St%2C%20Honolulu%2C%20HI'],
  ['web', 'https://www.google.com/maps/dir/?api=1&destination=12%20Main%20St%2C%20Honolulu%2C%20HI'],
])('builds %s directions for the chosen address without a fan location', (platform, want) => {
  expect(gameDirectionsUrl(' 12 Main St, Honolulu, HI ', platform)).toBe(want);
});

it.each([undefined, null, '', '   ', 'x'.repeat(321), '\uD800'])('does not offer directions for absent or malformed addresses', (address) => {
  expect(gameDirectionsUrl(address, 'ios')).toBeNull();
});

it('encodes address punctuation as destination text rather than extra parameters', () => {
  expect(gameDirectionsUrl('A&B #2?origin=private', 'web')).toBe('https://www.google.com/maps/dir/?api=1&destination=A%26B%20%232%3Forigin%3Dprivate');
});

it('hands off the HTTPS destination and preserves a failed map open as a failure', async () => {
  jest.mocked(Linking.openURL).mockRejectedValueOnce(new Error('No maps handler'));
  await expect(openGameDirections('12 Main St')).rejects.toThrow('No maps handler');
  expect(Linking.openURL).toHaveBeenCalledWith(Platform.OS === 'ios' ? 'https://maps.apple.com/?daddr=12%20Main%20St' : 'https://www.google.com/maps/dir/?api=1&destination=12%20Main%20St');
});

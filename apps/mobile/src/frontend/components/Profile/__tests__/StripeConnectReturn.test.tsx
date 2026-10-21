/** Provider return can select only the fixed profile or parent route; arbitrary redirect parameters are ignored. */
import { render, screen } from '@testing-library/react-native';
import StripeConnectReturn from '../../../../../app/stripe-connect';
let mockParams: Record<string, unknown> = {};
jest.mock('expo-router', () => ({ useLocalSearchParams: () => mockParams, Redirect: ({ href }: { href: string }) => { const { Text } = require('react-native'); return <Text>{href}</Text>; } }));
beforeEach(() => { mockParams = {}; });
it('returns a valid athlete-scoped bank session to Parent HQ', async () => {
 mockParams = { playerId: '11111111-1111-4111-8111-111111111111' };
 await render(<StripeConnectReturn />); expect(screen.getByText('/parent?playerId=11111111-1111-4111-8111-111111111111')).toBeTruthy();
});
it('returns ordinary bank setup to the profile', async () => { await render(<StripeConnectReturn />); expect(screen.getByText('/profile')).toBeTruthy(); });
it.each(['https://evil.test', '../parent', ['11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222222']])('ignores malformed player routing %s', async playerId => {
 mockParams = { playerId, redirectTo: 'https://evil.test' }; await render(<StripeConnectReturn />); expect(screen.getByText('/profile')).toBeTruthy();
});

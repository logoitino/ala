/**
 * First-open welcome shows the owner-approved Donate. Elevate. Celebrate. message (BRAND-01) as plain
 * text under the mission, without competing with the screen title as a heading.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, render, screen } from '@testing-library/react-native';

import { WelcomeOverlay } from '@/components/Onboarding/WelcomeOverlay';
import { DONATION_MISSION, TAGLINE_HEADLINE, TAGLINE_LINE } from '@/data/malo';
import { ONBOARDING_SEEN_KEY } from '@/lib/auth';

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('@/lib/haptics', () => ({ impactPress: jest.fn() }));

describe('WelcomeOverlay brand message', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  it('shows the tagline headline and line as plain text on first open', async () => {
    await render(<WelcomeOverlay />);
    expect(await screen.findByText(TAGLINE_HEADLINE)).toBeTruthy();
    expect(screen.getByText(TAGLINE_LINE)).toBeTruthy();
    expect(screen.getByText(new RegExp(DONATION_MISSION.slice(0, 30)))).toBeTruthy();
    expect(screen.queryByRole('header', { name: TAGLINE_HEADLINE })).toBeNull();
  });

  it('stays hidden once the welcome has been seen', async () => {
    await AsyncStorage.setItem(ONBOARDING_SEEN_KEY, '1');
    await render(<WelcomeOverlay />);
    await act(async () => { await Promise.resolve(); });
    expect(screen.queryByText(TAGLINE_HEADLINE)).toBeNull();
  });
});

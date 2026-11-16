/**
 * FEED-01 Phase 1: Highlights picks sheet and Settings → Highlights open when the parent sets them visible.
 * This is a component render. It is not a signed-in Home or Profile session.
 */
import { act, fireEvent, render, screen } from '@testing-library/react-native';

import { HighlightsFeedSettingsSheet } from '@/components/Profile/HighlightsFeedSettingsSheet';
import { FeedPicksSheet } from '@/components/Reels/FeedPicksSheet';
import type { UserFeedPrefs } from '@/data/highlights';

jest.mock('expo-blur', () => ({ BlurView: () => null }));
jest.mock('@expo/vector-icons/Ionicons', () => 'Ionicons');
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

const prefs: UserFeedPrefs = {
  sports: [],
  schools: [],
  categoryPref: 'all',
  personalizationOn: true,
};

describe('FeedPicksSheet', () => {
  it('shows first-run picks when visible', async () => {
    await render(
      <FeedPicksSheet
        visible
        prefs={prefs}
        sportOptions={['Football']}
        schoolOptions={['East High']}
        onClose={jest.fn()}
        onSkip={jest.fn()}
        onSave={jest.fn()}
      />,
    );
    expect(screen.getByText('Shape your Highlights')).toBeTruthy();
    expect(screen.getByText(/Sports · 0 of 3/)).toBeTruthy();
    expect(screen.getByText(/Schools · 0 of 3/)).toBeTruthy();
    expect(screen.getByText(/Category lean · All/)).toBeTruthy();
    expect(screen.getByLabelText('Sport Football')).toBeTruthy();
    expect(screen.getByLabelText('School East High')).toBeTruthy();
    await act(async () => {
      await fireEvent.press(screen.getByLabelText('Sport Football'));
    });
    expect(await screen.findByText(/Sports · 1 of 3 · Football/)).toBeTruthy();
    expect(screen.getByLabelText('Save Highlights picks')).toBeTruthy();
    expect(screen.getByLabelText('Not now')).toBeTruthy();
  });

  it('renders nothing while closed', async () => {
    await render(
      <FeedPicksSheet
        visible={false}
        prefs={prefs}
        sportOptions={['Football']}
        schoolOptions={[]}
        onClose={jest.fn()}
        onSave={jest.fn()}
      />,
    );
    expect(screen.queryByText('Shape your Highlights')).toBeNull();
  });
});

describe('HighlightsFeedSettingsSheet', () => {
  it('opens Personal feed and the edit picks sheet', async () => {
    await render(
      <HighlightsFeedSettingsSheet
        visible
        prefs={prefs}
        sportOptions={['Football']}
        schoolOptions={['East High']}
        onClose={jest.fn()}
        onSave={jest.fn(async () => undefined)}
        onTogglePersonalization={jest.fn(async () => undefined)}
      />,
    );
    expect(screen.getByText('Highlights')).toBeTruthy();
    expect(screen.getByLabelText('Personal feed')).toBeTruthy();
    fireEvent.press(screen.getByText('Edit sports, schools & lean'));
    expect(await screen.findByText('Edit Highlights picks')).toBeTruthy();
    expect(screen.getByLabelText('Save Highlights picks')).toBeTruthy();
    expect(screen.queryByLabelText('Not now')).toBeNull();
  });
});

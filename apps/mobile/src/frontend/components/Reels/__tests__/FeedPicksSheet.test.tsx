/**
 * FEED-01 Phase 1: Highlights picks sheet and Settings → Highlights open when the parent sets them visible.
 * Web workspace layout retains pick limits and drafts across responsive frames; native keeps its original geometry.
 * This is a component render. It is not a signed-in Home or Profile session.
 */
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import { HighlightsFeedSettingsSheet } from '@/components/Profile/HighlightsFeedSettingsSheet';
import { FeedPicksSheet } from '@/components/Reels/FeedPicksSheet';
import { Platform, StyleSheet } from 'react-native';
import { SheetPresentationContext } from '@/components/UI/SheetPresentationContext';
import { REEL_CATEGORY_TRAIN, type UserFeedPrefs } from '@/data/highlights';

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


describe('web account picks layout', () => {
  const originalPlatform = Platform.OS;
  afterEach(() => {
    Object.defineProperty(Platform, 'OS', { configurable: true, value: originalPlatform });
    jest.restoreAllMocks();
  });
  const dimensions = (os: string, width: number) => {
    Object.defineProperty(Platform, 'OS', { configurable: true, value: os });
    return jest.spyOn(require('react-native'), 'useWindowDimensions').mockReturnValue({ width, height: 600, scale: 1, fontScale: 1 });
  };
  const picker = (onSave = jest.fn(), scope: 'default' | 'web-workspace' = 'web-workspace', onClose = jest.fn()) => (
    <SheetPresentationContext.Provider value={scope}>
      <FeedPicksSheet visible prefs={{ ...prefs, personalizationOn: false }}
        sportOptions={['Football', 'Basketball', 'Soccer', 'Volleyball']}
        schoolOptions={['East High']} onClose={onClose} onSave={onSave} />
    </SheetPresentationContext.Provider>
  );

  it.each(['ios', 'android'])('keeps the original %s picker inside a workspace context', async os => {
    dimensions(os, 1400);
    await render(picker());
    expect(screen.queryByTestId('highlights-picks-columns')).toBeNull();
    expect(screen.queryByLabelText('Back to Highlights settings')).toBeNull();
    expect(StyleSheet.flatten(screen.getByTestId('highlights-picks-panel').props.style).maxWidth).toBeUndefined();
    expect(screen.getByText('East High').props.numberOfLines).toBe(1);
  });

  it('leaves ordinary web first-run geometry unchanged', async () => {
    dimensions('web', 1400);
    await render(picker(jest.fn(), 'default'));
    expect(screen.queryByTestId('highlights-picks-columns')).toBeNull();
    expect(screen.queryByLabelText('Back to Highlights settings')).toBeNull();
    expect(StyleSheet.flatten(screen.getByTestId('highlights-picks-panel').props.style).maxWidth).toBeUndefined();
  });

  it('offers an explicit return without saving the draft', async () => {
    dimensions('web', 900);
    const close = jest.fn(), save = jest.fn();
    await render(picker(save, 'web-workspace', close));
    await fireEvent.press(screen.getByLabelText('Sport Football'));
    await fireEvent.press(screen.getByLabelText('Back to Highlights settings'));
    expect(close).toHaveBeenCalledTimes(1);
    expect(save).not.toHaveBeenCalled();
  });

  it('keeps limits and the unsaved draft when the workspace becomes narrow', async () => {
    const size = dimensions('web', 900);
    const save = jest.fn(async () => undefined);
    const view = await render(picker(save));
    expect(StyleSheet.flatten(screen.getByTestId('highlights-picks-panel').props.style).maxWidth).toBe(760);
    expect(screen.getByTestId('highlights-picks-columns')).toBeTruthy();
    expect(screen.getByText('East High').props.numberOfLines).toBeUndefined();
    for (const name of ['Football', 'Basketball', 'Soccer']) await fireEvent.press(screen.getByLabelText(`Sport ${name}`));
    expect(screen.getByLabelText('Sport Volleyball').props.accessibilityState.disabled).toBe(true);
    await fireEvent.press(screen.getByLabelText('School East High'));
    await fireEvent.press(screen.getByLabelText('Category Train Like Me'));
    size.mockReturnValue({ width: 390, height: 600, scale: 1, fontScale: 1 });
    await view.rerender(picker(save));
    expect(screen.queryByTestId('highlights-picks-columns')).toBeNull();
    expect(screen.getByLabelText('Sport Football').props.accessibilityState.checked).toBe(true);
    await fireEvent.press(screen.getByLabelText('Save Highlights picks'));
    await waitFor(() => expect(save).toHaveBeenCalledWith({ sports: ['Football', 'Basketball', 'Soccer'], schools: ['East High'], categoryPref: REEL_CATEGORY_TRAIN, personalizationOn: false }));
  });
});

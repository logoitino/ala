/** Profile identity must preserve the accessible jersey value and keep favorite-athlete details off community heroes. */
import { fireEvent, render, screen, within } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import { ProfileHeroAvatar } from '@/components/Profile/ProfileHeroAvatar';
import { FOCAL } from '@/theme/motion';

jest.mock('@/components/Profile/ProfileAvatarPicker', () => ({
  ProfileAvatarPicker: ({ children }: { children: React.ReactNode }) => children,
}));
jest.mock('@/components/Profile/SubscriberCrest', () => ({ SubscriberCrest: () => null }));
jest.mock('@/components/Profile/VarsityBadge', () => ({ VarsityBadge: () => null }));
jest.mock('@/components/Verification/SchoolCrest', () => {
  const { Text } = jest.requireActual('react-native');
  return { SchoolCrest: () => <Text>Confirmed crest</Text>, SchoolHeroBand: () => <Text>Confirmed band</Text> };
});
jest.mock('@/components/UI/AnimatedButton', () => {
  const { Pressable } = jest.requireActual('react-native');
  return {
    AnimatedButton: ({ contentStyle, style, ...props }: { contentStyle?: object; style?: object }) => (
      <Pressable {...props} style={[style, contentStyle]} />
    ),
  };
});

describe.each([false, true])('ProfileHeroAvatar identity (compact=%s)', (compact) => {
  it('shows supplied athlete details, preserves jersey zero and keeps the Aura action available', async () => {
    const onFlip = jest.fn();
    const longName = 'Ana Maria Fa’aloalo-Latu';
    await render(
      <ProfileHeroAvatar compact={compact} name={longName} school="West Valley College" jersey={0} auraPoints={0}
        sport="Volleyball" position="Outside hitter / defensive specialist" classYear="27"
        showFlipControl onFlipAura={onFlip} />,
    );
    expect(screen.getByRole('header', { name: longName })).toBeTruthy();
    expect(within(screen.getByLabelText('Jersey number 0')).getByText('0')).toBeTruthy();
    expect(screen.getByLabelText('Sport: Volleyball')).toBeTruthy();
    // The compact athlete hero draws the athlete's own surface, hidden from screen readers.
    if (compact) {
      expect(screen.getByTestId('sport-field-volleyball', { includeHiddenElements: true })).toBeTruthy();
      expect(screen.queryByTestId('sport-field-volleyball')).toBeNull();
    }
    expect(screen.getByLabelText('Position: Outside hitter / defensive specialist')).toBeTruthy();
    expect(screen.getByLabelText("Class: '27")).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Flip Aura card'));
    expect(onFlip).toHaveBeenCalledTimes(1);
  });

  it('does not invent a sport, position or class when the metadata is absent', async () => {
    const view = await render(<ProfileHeroAvatar compact={compact} name="Ana Latu" auraPoints={0} sport=" " position="—" classYear=" " />);
    expect(screen.getByText('AL')).toBeTruthy();
    expect(screen.queryByText('Sport')).toBeNull();
    expect(screen.queryByText('Position')).toBeNull();
    expect(screen.queryByText('Class')).toBeNull();
    expect(screen.queryByText('Football')).toBeNull();
    await view.rerender(<ProfileHeroAvatar compact={compact} name="Ana Latu" auraPoints={0} classYear="—" />);
    expect(screen.queryByText('Class')).toBeNull();
  });

  it('hides athlete credentials on the community hero even if a favorite roster supplied them', async () => {
    await render(<ProfileHeroAvatar compact={compact} name="Fan" athlete={false} auraPoints={0} jersey={12}
      sport="Football" position="Quarterback" classYear="26" />);
    expect(screen.getByText('Community profile')).toBeTruthy();
    expect(screen.queryByLabelText('Jersey number 12')).toBeNull();
    // UX-08: field lines are athlete identity; community heroes stay plain.
    expect(screen.queryByTestId(/^sport-field-/, { includeHiddenElements: true })).toBeNull();
    expect(screen.queryByText('Football')).toBeNull();
    expect(screen.queryByText('Quarterback')).toBeNull();
    expect(screen.queryByText("'26")).toBeNull();
  });

  it('keeps a favorite athlete’s confirmed school off a community hero', async () => {
    const badge = { schoolId: 'school', schoolName: 'North Valley', mascot: null, logoUrl: null,
      colorPrimary: null, colorSecondary: null, confirmedAt: null, confirmedBy: 'coach' as const };
    const view = await render(<ProfileHeroAvatar compact={compact} name="Fan" athlete={false} auraPoints={0} schoolBadge={badge} />);
    expect(screen.queryByText('Confirmed crest')).toBeNull();
    expect(screen.queryByText('Confirmed band')).toBeNull();
    expect(screen.queryByText(/North Valley athlete/)).toBeNull();
    await view.rerender(<ProfileHeroAvatar compact={compact} name="Athlete" athlete auraPoints={0} schoolBadge={badge} />);
    expect(screen.getByText('Confirmed crest')).toBeTruthy();
    expect(screen.getByText(/North Valley athlete/)).toBeTruthy();
  });
});

it('fills the Aura card control with the earned tier color', async () => {
  await render(<ProfileHeroAvatar compact name="rain" auraPoints={71} showFlipControl onFlipAura={jest.fn()} />);
  const button = screen.getByLabelText('Flip Aura card');
  expect(StyleSheet.flatten(button.props.style).backgroundColor).toBe(FOCAL.ember);
  expect(StyleSheet.flatten(screen.getByText('Aura card').props.style).color).toBe(FOCAL.ink);
  expect(screen.getByText('3% to Polished Gold')).toBeTruthy();
});

it('exposes the compact Aura meter without losing its value to visual compression', async () => {
  await render(<ProfileHeroAvatar compact name="Ana Latu" auraPoints={0} />);
  expect(screen.getByRole('progressbar', { name: 'Aura progress' }).props.accessibilityValue)
    .toEqual(expect.objectContaining({ min: 0, max: 100, now: 0, text: expect.stringContaining('0 Aura') }));
});

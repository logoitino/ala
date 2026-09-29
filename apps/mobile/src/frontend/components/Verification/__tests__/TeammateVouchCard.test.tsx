import { fireEvent, render, screen } from '@testing-library/react-native';

import { TeammateVouchCardView } from '@/components/Verification/TeammateVouchCard';

jest.mock('@/components/UI/HapticPressable', () => {
  const { Pressable } = jest.requireActual('react-native');
  return { HapticPressable: Pressable };
});

const MATE = { requestId: 'r1', name: 'Sione', sport: 'Rugby', classYear: '2027', jersey: '9', vouches: 1, vouchedByMe: false };

describe('TeammateVouchCardView', () => {
  it('renders nothing with no one to vouch for', async () => {
    await render(<TeammateVouchCardView teammates={[]} busyId={null} error={null} onVouch={jest.fn()} />);
    expect(screen.queryByText('Teammates waiting')).toBeNull();
  });

  it('vouches for a teammate and shows who is already vouched', async () => {
    const onVouch = jest.fn();
    await render(
      <TeammateVouchCardView
        teammates={[MATE, { ...MATE, requestId: 'r2', name: 'Tevita', vouchedByMe: true }]}
        busyId={null}
        error={null}
        onVouch={onVouch}
      />,
    );
    expect(screen.getAllByText('Rugby · Class of 2027 · #9 · 1/3 vouches')).toHaveLength(2);
    await fireEvent.press(screen.getByLabelText('Vouch for Sione'));
    expect(onVouch).toHaveBeenCalledWith('r1');
    expect(screen.getByText('Vouched ✓')).toBeTruthy();
  });
});

import { fireEvent, render, screen } from '@testing-library/react-native';

import { ReceivedMaloPanel } from '@/components/Profile/ReceivedMaloPanel';
import { THANKS_MESSAGES } from '@/lib/donationThanks';

const mockThank = jest.fn(async () => ({ ok: true as const }));
const mockToast = jest.fn();

jest.mock('@/hooks/useReceivedMalo', () => ({
  useReceivedMalo: () => ({
    loading: false,
    totalCents: 1500,
    rows: [
      { id: 't1', fan_name: 'Sina', amount_cents: 500, origin: 'rally', entry: 'in_app', source_label: 'New cleats' },
      { id: 't2', fan_name: 'Tavita', amount_cents: 1000, origin: 'profile', entry: 'in_app', source_label: null },
    ],
  }),
}));

jest.mock('@/hooks/useDonationThanks', () => ({
  useDonationsToThank: () => ({
    rows: [
      { tipId: 't1', amountCents: 500, createdAt: '', fanName: 'Sina', rallyTitle: 'New cleats', thankedKey: null },
      { tipId: 't2', amountCents: 1000, createdAt: '', fanName: 'Tavita', rallyTitle: null, thankedKey: 'family' },
    ],
    thank: mockThank,
  }),
}));

jest.mock('@/context/CelebrationContext', () => ({ useOptionalCelebration: () => ({ showToast: mockToast }) }));

jest.mock('@/components/UI/HapticPressable', () => {
  const { Pressable } = jest.requireActual('react-native');
  return { HapticPressable: Pressable };
});

describe('ReceivedMaloPanel say thanks', () => {
  it('nudges the athlete and sends a preset thank-you in two taps', async () => {
    await render(<ReceivedMaloPanel playerId="p1" />);

    expect(screen.getByText('1 donor is waiting for a thank-you.')).toBeTruthy();
    expect(screen.getByText(/Thanked ✓ “My family and I thank you\.”/)).toBeTruthy();

    await fireEvent.press(screen.getByLabelText('Say thanks to Sina'));
    await fireEvent.press(screen.getByText('Thank you — this helps with my gear.'));

    expect(mockThank).toHaveBeenCalledWith('t1', 'gear');
    expect(mockToast).toHaveBeenCalledWith('Thank-you sent 🙏');
  });

  it('offers the five presets only (no free text for minors)', async () => {
    await render(<ReceivedMaloPanel playerId="p1" />);
    await fireEvent.press(screen.getByLabelText('Say thanks to Sina'));
    for (const message of THANKS_MESSAGES) expect(screen.getByText(message.text)).toBeTruthy();
    expect(screen.getByLabelText('Pick a thank-you message').children).toHaveLength(THANKS_MESSAGES.length + 1);
  });
});

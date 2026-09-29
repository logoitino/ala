import { fireEvent, render, screen } from '@testing-library/react-native';
import { Alert } from 'react-native';

import { AthleteMoneyCard } from '@/components/Custodial/AthleteMoneyCard';
import { parseCustodialSummary } from '@/lib/custodial';

const mockDecide = jest.fn(async () => undefined);
let mockSummary: ReturnType<typeof parseCustodialSummary> = null;

jest.mock('@/hooks/useCustodial', () => ({
  useCustodial: () => ({ summary: mockSummary, available: true, busy: false, decide: mockDecide }),
}));

jest.mock('@/components/UI/HapticPressable', () => {
  const { Pressable } = jest.requireActual('react-native');
  return { HapticPressable: Pressable };
});

const RAW = {
  viewer_role: 'athlete',
  athlete_name: 'Malia',
  guardian_linked: true,
  guardian_name: 'Losa',
  handover_age: 18,
  handover_date: '2027-03-04',
  athlete_controls: false,
  received_cents: 12500,
  requests: [
    { id: 'r1', requested_role: 'guardian', amount_cents: 4000, note: 'Club fee', status: 'pending_athlete', created_at: '2026-09-29T00:00:00Z' },
  ],
};

describe('AthleteMoneyCard', () => {
  it('shows the athlete the pending guardian request and asks before approving', async () => {
    mockSummary = parseCustodialSummary(RAW);
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    await render(<AthleteMoneyCard playerId="p1" />);

    expect(screen.getByText('Losa wants to withdraw $40')).toBeTruthy();
    expect(screen.getByText(/without your OK/)).toBeTruthy();

    await fireEvent.press(screen.getByText('Approve'));
    expect(alert).toHaveBeenCalledWith('Let Losa withdraw $40?', expect.any(String), expect.any(Array));
    expect(mockDecide).not.toHaveBeenCalled();
    alert.mockRestore();
  });

  it('renders nothing for a guardian looking at the same athlete', async () => {
    mockSummary = parseCustodialSummary({ ...RAW, viewer_role: 'guardian' });
    await render(<AthleteMoneyCard playerId="p1" />);
    expect(screen.queryByText('Approve')).toBeNull();
  });
});

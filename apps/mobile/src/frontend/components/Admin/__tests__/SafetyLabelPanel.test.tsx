/** Coach-level desk: a missing migration is unknown, never a zero count. */
import { render, screen, waitFor } from '@testing-library/react-native';

import { SafetyLabelPanel } from '@/components/Admin/SafetyLabelPanel';
import { NOT_SWITCHED_ON } from '@/lib/rpc';
import * as labels from '@/lib/safetyLabels';

jest.mock('@/lib/safetyLabels', () => ({
  fetchCoachLabelDesk: jest.fn(),
  setCoachLabel: jest.fn(),
}));

it('says the counts are unknown when the migration is not applied', async () => {
  jest.mocked(labels.fetchCoachLabelDesk).mockRejectedValue(new Error(NOT_SWITCHED_ON));
  await render(<SafetyLabelPanel />);
  expect(await screen.findByText(/counts are unknown/)).toBeTruthy();
  expect(screen.queryByText('0')).toBeNull();
  await waitFor(() => expect(labels.fetchCoachLabelDesk).toHaveBeenCalled());
});

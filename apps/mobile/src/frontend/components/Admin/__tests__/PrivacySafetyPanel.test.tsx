/** PRIV-01 admin desk: counts only (never who), the repairs call the right functions, failures say so. Synthetic data. */
// The minor-accounts case file has its own tests (MinorAccountsPanel.test.tsx).
jest.mock('@/components/Admin/MinorAccountsPanel', () => ({ MinorCaseFile: () => null, MinorReport: () => null }));
jest.mock('@/components/Admin/PayeeVerificationPanel', () => ({ PayeeVerificationPanel: () => null, PayeeReport: () => null }));
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import { PrivacyReport, PrivacySafetyPanel } from '../PrivacySafetyPanel';
import * as privacy from '@/lib/privacy';

jest.mock('@/lib/privacy', () => ({
  ...jest.requireActual('@/lib/privacy'),
  adminFetchPrivacy: jest.fn(), adminPrivacyReport: jest.fn(), adminResetPrivacy: jest.fn(),
  adminSetHideFromSearch: jest.fn(),
}));
const m = jest.mocked(privacy);
const base = privacy.parsePrivacy({ account_private: true, friend_requests_from: 'teens' });

beforeEach(() => {
  jest.clearAllMocks();
  m.adminFetchPrivacy.mockResolvedValue({ ...base, friendCount: 4, pendingIncoming: 1, pendingOutgoing: 0, requestsSent7d: 2, blocksMade: 1, blocksReceived: 3 });
  m.adminResetPrivacy.mockResolvedValue(undefined);
  m.adminSetHideFromSearch.mockResolvedValue(undefined);
});

it('shows settings and counts (no guardian lock any more), then repairs', async () => {
  await render(<PrivacySafetyPanel profileId="p1" name="Kaleo" />);
  expect(await screen.findByText(/friend requests: teens only/)).toBeTruthy();
  expect(screen.queryByText(/Locked by/)).toBeNull();
  expect(screen.getByLabelText('Blocked by others 3')).toBeTruthy();
  await fireEvent.press(screen.getByLabelText('Reset to private defaults'));
  await waitFor(() => expect(m.adminResetPrivacy).toHaveBeenCalledWith('p1'));
  await fireEvent.press(screen.getByLabelText('Hide from search'));
  await waitFor(() => expect(m.adminSetHideFromSearch).toHaveBeenCalledWith('p1', true));
});

it('says when the report cannot be read instead of showing zeros', async () => {
  m.adminPrivacyReport.mockRejectedValue(new Error(privacy.ALWAYS_PUBLIC_NOTE.slice(0, 0) + 'This control is not switched on yet.'));
  await render(<PrivacyReport />);
  expect(await screen.findByText('This control is not switched on yet.')).toBeTruthy();
  expect(screen.queryByLabelText(/Private accounts/)).toBeNull();
});

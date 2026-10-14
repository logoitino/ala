/**
 * MINOR-01 admin desk (built before the app screens): the report counts and abuse signals, the under-13 deletion list,
 * the case file with names, and both repairs needing a reason. Synthetic data.
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import { MinorCaseFile, MinorReport } from '@/components/Admin/MinorAccountsPanel';
import * as minors from '@/lib/minors';

jest.mock('@/lib/minors', () => ({
  ...jest.requireActual('@/lib/minors'),
  adminMinorReport: jest.fn(), adminListAgeBlocked: jest.fn(), adminPurgeMinorRecords: jest.fn(),
  adminMinorOverview: jest.fn(), adminSetBirthMonth: jest.fn(), adminEndGuardianLink: jest.fn(),
}));
const m = jest.mocked(minors);

beforeEach(() => {
  jest.clearAllMocks();
  m.adminMinorReport.mockResolvedValue({
    teen1315: 4, teen1617: 2, adult: 30, notGiven: 1, unknown: 12, under13Blocked: 1, teensWithGuardian: 3,
    teensPublicConsent: 1, teensDonationsConsent: 1, pendingApprovals: 2, invites7d: 5, guardiansOver3Teens: 1,
    adultRequestsToTeens7d: 0, linksEnabled: false,
  });
  m.adminListAgeBlocked.mockResolvedValue([{ profileId: 'k1', userId: 'auth-k1', blockedAt: '2026-10-14T00:00:00Z' }]);
  m.adminPurgeMinorRecords.mockResolvedValue({ events: 3, invites: 1, attempts: 0, approvals: 2 });
});

it('reports bands, consents and abuse signals, lists under-13 sign-ins to delete, and purges on request', async () => {
  await render(<MinorReport />);
  expect(await screen.findByLabelText('Teens 13–15 4')).toBeTruthy();
  expect(screen.getByLabelText('Guardians with more than 3 teens 1')).toBeTruthy();
  expect(screen.getByText(/New guardian links are paused/)).toBeTruthy();
  expect(screen.getByText(/auth-k1/)).toBeTruthy();
  await fireEvent.press(screen.getByLabelText('Apply retention (events 365 days, codes 30 days)'));
  expect(await screen.findByText('Removed 3 events, 1 codes, 0 tries and 2 old requests.')).toBeTruthy();
});

it('the case file shows links and consent records, and both repairs need a reason', async () => {
  m.adminMinorOverview.mockResolvedValue({
    ageBand: 'teen_13_15', birthYear: 2012, birthMonth: 3, ageBlockedAt: null,
    links: [{ linkId: 'l1', guardianName: 'Mele Fua', guardianTeens: 5, source: 'invite', createdAt: '2026-10-14', confirmedAt: '2026-10-14', endedAt: null, endReason: null }],
    consents: [{ signedAt: '2026-10-14', formVersion: '2026-10-14-draft', relationship: 'parent', allowsDonations: false, allowsPublicProfile: true, signerName: 'Mele Fua', revokedAt: null, revokeReason: null }],
    supervision: minors.parseSupervision({ summary: { friends: 2 } }),
  });
  m.adminEndGuardianLink.mockResolvedValue(undefined);
  m.adminSetBirthMonth.mockResolvedValue(undefined);
  await render(<MinorCaseFile profileId="p1" name="Lani" />);
  expect(await screen.findByText(/born Mar 2012/)).toBeTruthy();
  expect(screen.getByText(/supervises 5 teens/)).toBeTruthy();
  expect(screen.getByText(/signed .* by Mele Fua \(parent\): public profile yes, payouts no/)).toBeTruthy();
  expect(screen.getByLabelText('End link with Mele Fua')).toBeDisabled();
  await fireEvent.changeText(screen.getByLabelText('Reason (required for both repairs)'), 'Parent called support');
  await fireEvent.press(screen.getByLabelText('End link with Mele Fua'));
  await waitFor(() => expect(m.adminEndGuardianLink).toHaveBeenCalledWith('l1', 'Parent called support'));
  await fireEvent.changeText(screen.getByLabelText('Reason (required for both repairs)'), 'Typo at sign-up, ID seen');
  await fireEvent.changeText(screen.getByLabelText('Birth year'), '2011');
  await fireEvent.changeText(screen.getByLabelText('Birth month (1–12)'), '3');
  await fireEvent.press(screen.getByLabelText('Correct birth month and year'));
  await waitFor(() => expect(m.adminSetBirthMonth).toHaveBeenCalledWith('p1', 2011, 3, 'Typo at sign-up, ID seen'));
});

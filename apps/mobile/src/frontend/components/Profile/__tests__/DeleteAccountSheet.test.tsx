/**
 * Delete account sheet records a Feedback request then signs out — it does not claim automated erasure.
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

const mockSignOut = jest.fn(async () => undefined);
const mockSubmitAppFeedback = jest.fn(async () => undefined);

jest.mock('@/context/AuthContext', () => ({
  useAuth: () => ({
    signOut: mockSignOut,
    profile: { username: 'mele', full_name: 'Mele' },
    user: { id: 'user-1' },
  }),
}));

jest.mock('@/lib/feedback', () => ({
  submitAppFeedback: (...args: unknown[]) => mockSubmitAppFeedback(...args),
}));

jest.mock('@/hooks/useSheetFrame', () => ({
  SHEET_BLUR_INTENSITY: 24,
  useSheetFrame: () => ({
    dock: { paddingHorizontal: 12 },
    card: { padding: 16 },
  }),
}));

jest.mock('expo-blur', () => ({ BlurView: ({ children }: { children?: unknown }) => children ?? null }));

import { DeleteAccountSheet } from '@/components/Profile/DeleteAccountSheet';

describe('DeleteAccountSheet', () => {
  beforeEach(() => {
    mockSignOut.mockClear();
    mockSubmitAppFeedback.mockClear();
  });

  it('submits an account-deletion feedback request and signs out', async () => {
    const onClose = jest.fn();
    await render(<DeleteAccountSheet visible onClose={onClose} />);

    fireEvent.press(screen.getByLabelText('Request account deletion and sign out'));

    await waitFor(() => expect(mockSubmitAppFeedback).toHaveBeenCalled());
    expect(String(mockSubmitAppFeedback.mock.calls[0]?.[0])).toContain('[account-deletion-request]');
    expect(mockSubmitAppFeedback.mock.calls[0]?.[1]).toBe('other');
    expect(mockSubmitAppFeedback.mock.calls[0]?.[2]).toBe('profile');
    await waitFor(() => expect(mockSignOut).toHaveBeenCalled());
    expect(onClose).toHaveBeenCalled();
  });
});

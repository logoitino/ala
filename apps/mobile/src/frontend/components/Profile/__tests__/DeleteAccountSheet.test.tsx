/**
 * Delete account sheet records a Feedback request then signs out — it does not claim automated erasure.
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

const mockSignOut = jest.fn(async () => undefined);
const mockSubmitAppFeedback = jest.fn<Promise<void>, [string, string?, string?]>(async () => undefined);

jest.mock('@/context/AuthContext', () => ({
  useAuth: () => ({
    signOut: mockSignOut,
    profile: { username: 'mele', full_name: 'Mele' },
    user: { id: 'user-1' },
  }),
}));

jest.mock('@/lib/feedback', () => ({
  submitAppFeedback: (body: string, kind?: string, surface?: string) => mockSubmitAppFeedback(body, kind, surface),
}));

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
    const [body, kind, surface] = mockSubmitAppFeedback.mock.calls[0] ?? [];
    expect(String(body)).toContain('[account-deletion-request]');
    expect(kind).toBe('other');
    expect(surface).toBe('profile');
    await waitFor(() => expect(mockSignOut).toHaveBeenCalled());
    expect(onClose).toHaveBeenCalled();
  });

  it('renders nothing while closed so Profile tests need no SafeAreaProvider', async () => {
    await render(<DeleteAccountSheet visible={false} onClose={jest.fn()} />);
    expect(screen.queryByLabelText('Request account deletion and sign out')).toBeNull();
  });
});

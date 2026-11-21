/**
 * Delete account sheet records a Feedback request then signs out — it does not claim automated erasure.
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

let mockActorReady = true;
const mockSignOut = jest.fn(async () => { mockActorReady = false; });
const mockSubmitAppFeedback = jest.fn<Promise<void>, [string, string?, string?]>(async () => undefined);

let mockCurrent = true;
jest.mock('@/services/OfflineQueue', () => ({ offlineQueue: { captureActor: () => mockActorReady ? ({ userId: 'user-1', isCurrent: () => mockCurrent }) : null } }));
jest.mock('@/lib/offlineActor', () => ({ createOfflineActorClient: async () => ({}), assertCurrent: (actor: { isCurrent: () => boolean }) => { if (!actor.isCurrent()) throw new Error('Account changed'); } }));
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
    mockCurrent = true; mockActorReady = true;
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

  it('does not sign out or close the incoming account after an old request completes', async () => {
    let release!: () => void;
    mockSubmitAppFeedback.mockImplementationOnce(() => new Promise((resolve) => { release = resolve; }));
    const onClose = jest.fn();
    await render(<DeleteAccountSheet visible onClose={onClose} />);
    fireEvent.press(screen.getByLabelText('Request account deletion and sign out'));
    await waitFor(() => expect(mockSubmitAppFeedback).toHaveBeenCalled());
    mockCurrent = false;
    release();
    await waitFor(() => expect(screen.getByText('Account changed')).toBeTruthy());
    expect(mockSignOut).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });
  it('keeps a new session open when an issued sign-out settles after an account change', async () => {
    let release!: () => void;
    mockSignOut.mockImplementationOnce(() => new Promise((resolve) => { release = resolve; }));
    const onClose = jest.fn();
    await render(<DeleteAccountSheet visible onClose={onClose} />);
    fireEvent.press(screen.getByLabelText('Request account deletion and sign out'));
    await waitFor(() => expect(mockSignOut).toHaveBeenCalled());
    mockCurrent = false;
    release();
    await waitFor(() => expect(screen.getByText('Account changed. Reopen this action.')).toBeTruthy());
    expect(onClose).not.toHaveBeenCalled();
  });
  it('renders nothing while closed so Profile tests need no SafeAreaProvider', async () => {
    await render(<DeleteAccountSheet visible={false} onClose={jest.fn()} />);
    expect(screen.queryByLabelText('Request account deletion and sign out')).toBeNull();
  });
});

import { render, fireEvent, waitFor, act } from '@testing-library/react-native';
import { BeyondGamePanel } from '@/components/Admin/BeyondGamePanel';
import * as api from '@/lib/beyondGame';
let mockAuth = { user: { id: 'u1' }, profile: { id: 'p1', user_id: 'u1', age_blocked_at: null as string | null }, isAdmin: true, loading: false };
jest.mock('expo-video', () => ({ useVideoPlayer: () => ({ loop: false, pause: jest.fn(), addListener: () => ({ remove: jest.fn() }) }), VideoView: require('react-native').View }));
jest.mock('@/context/AuthContext', () => ({ useAuth: () => mockAuth }));
jest.mock('@/lib/beyondGame', () => ({ fetchAdminBeyondStatus: jest.fn(), fetchAdminBeyondPosts: jest.fn(), adminSetBeyondEnabled: jest.fn(), adminReviewBeyondPost: jest.fn(), signBeyondMedia: jest.fn(), adminBeyondCleanup: jest.fn(), adminBeyondRetention: jest.fn(), adminEraseBeyondProfile: jest.fn() }));
const status = { enabled: false, missing: [], pending: 0, cleanupPending: 0, changedAt: null, reason: null };
beforeEach(() => {
    jest.clearAllMocks();
    mockAuth = { user: { id: 'u1' }, profile: { id: 'p1', user_id: 'u1', age_blocked_at: null }, isAdmin: true, loading: false };
    (api.fetchAdminBeyondStatus as jest.Mock).mockResolvedValue(status);
    (api.fetchAdminBeyondPosts as jest.Mock).mockResolvedValue({ posts: [], enabled: false, nextId: null });
});
it('does not read or render admin actions for role preview without a real user', async () => {
    mockAuth = { ...mockAuth, user: null as never };
    const ui = await render(<BeyondGamePanel />);
    expect(ui.queryByText('Switch Beyond the Game on')).toBeNull();
    expect(api.fetchAdminBeyondStatus).not.toHaveBeenCalled();
});
it('keeps old actor replies out of the next account', async () => {
    let reply: (v: unknown) => void = () => {
    };
    (api.fetchAdminBeyondStatus as jest.Mock).mockImplementationOnce(() => new Promise(r => {
        reply = r;
    }));
    const ui = await render(<BeyondGamePanel />);
    mockAuth = { ...mockAuth, user: { id: 'u2' }, profile: { id: 'p2', user_id: 'u2', age_blocked_at: null } };
    await ui.rerender(<BeyondGamePanel />);
    await waitFor(() => expect(api.fetchAdminBeyondStatus).toHaveBeenCalledWith('p2'));
    await act(async () => reply({ ...status, reason: 'OLD PRIVATE REASON' }));
    expect(ui.queryByText(/OLD PRIVATE REASON/)).toBeNull();
});
it('does not admit a pre-closure reply when the same admin account reopens', async () => {
    let reply: (v: unknown) => void = () => {
    };
    (api.fetchAdminBeyondStatus as jest.Mock).mockImplementationOnce(() => new Promise(r => {
        reply = r;
    }));
    const ui = await render(<BeyondGamePanel />);
    mockAuth = { ...mockAuth, profile: { ...mockAuth.profile, age_blocked_at: '2026-10-16T02:00:00Z' } };
    await ui.rerender(<BeyondGamePanel />);
    expect(ui.getByText(/authorized admin session/)).toBeTruthy();
    mockAuth = { ...mockAuth, profile: { ...mockAuth.profile, age_blocked_at: null } };
    await ui.rerender(<BeyondGamePanel />);
    await waitFor(() => expect(ui.getByText('Switch Beyond the Game on')).toBeTruthy());
    await act(async () => reply({ ...status, reason: 'PRE CLOSURE PRIVATE' }));
    expect(ui.queryByText(/PRE CLOSURE PRIVATE/)).toBeNull();
});
it('clears old queue on failed refresh instead of leaving actionable stale rows', async () => {
    (api.fetchAdminBeyondStatus as jest.Mock).mockResolvedValue({ ...status, reason: 'Earlier status' });
    const ui = await render(<BeyondGamePanel />);
    await waitFor(() => expect(ui.getByText(/Earlier status/)).toBeTruthy());
    (api.fetchAdminBeyondStatus as jest.Mock).mockRejectedValue(new Error('raw private error'));
    await fireEvent.press(ui.getByText('Refresh review queue'));
    await waitFor(() => expect(ui.queryByText(/Earlier status/)).toBeNull());
    expect(ui.getByText(/could not be refreshed/)).toBeTruthy();
    expect(ui.queryByText(/raw private error/)).toBeNull();
});
it('requires a reason and current actor when changing the real switch', async () => {
    (api.adminSetBeyondEnabled as jest.Mock).mockResolvedValue({ ...status, enabled: true });
    const ui = await render(<BeyondGamePanel />);
    await waitFor(() => expect(ui.getByText('Switch Beyond the Game on')).toBeTruthy());
    await fireEvent.changeText(ui.getByLabelText('Review or switch reason'), 'Reviewed pilot controls');
    await fireEvent.press(ui.getByText('Switch Beyond the Game on'));
    await waitFor(() => expect(api.adminSetBeyondEnabled).toHaveBeenCalledWith('p1', true, 'Reviewed pilot controls'));
});
it('clears pending preview and actions immediately on auth loss', async () => {
    const ui = await render(<BeyondGamePanel />);
    await waitFor(() => expect(ui.getByText('Switch Beyond the Game on')).toBeTruthy());
    mockAuth = { ...mockAuth, isAdmin: false };
    await ui.rerender(<BeyondGamePanel />);
    expect(ui.queryByText('Switch Beyond the Game on')).toBeNull();
    expect(ui.getByText(/authorized admin session/)).toBeTruthy();
});
const post = (id: string) => ({ id, creatorId: 'author', category: 'story', caption: `Caption ${id}`, audience: 'friends', status: 'pending', revision: 2, createdAt: '2026-10-16T01:00:00Z', submittedAt: '2026-10-16T01:01:00Z', attestedAt: '2026-10-16T01:00:00Z', rightsVersion: 'beyond-rights-1', safetyVersion: 'beyond-safety-1', cleanup: 'not_requested', media: [{ id: `media-${id}`, position: 0, kind: 'photo', path: `owner/${id}/media.jpg`, mime: 'image/jpeg', bytes: 24, width: 1, height: 1, durationMs: null }], reviewReason: null, reviewedAt: null, reportCount: 0 });
it('requires the current photo to load before approval and rejects an old preview callback', async () => {
    (api.fetchAdminBeyondPosts as jest.Mock).mockResolvedValue({ posts: [post('one'), post('two')], nextId: null, enabled: true });
    (api.signBeyondMedia as jest.Mock).mockResolvedValue({ url: 'https://private.invalid/preview', expiresAt: Date.now() + 60000 });
    const ui = await render(<BeyondGamePanel />);
    await waitFor(() => expect(ui.getByText('Preview submission one')).toBeTruthy());
    await fireEvent.press(ui.getByText('Preview submission one'));
    await waitFor(() => expect(ui.getByLabelText('Private submission photo 1')).toBeTruthy());
    const oldLoad = ui.getByLabelText('Private submission photo 1').props.onLoad;
    await fireEvent.press(ui.getByText('Close private preview'));
    await fireEvent.press(ui.getByText('Preview submission two'));
    await waitFor(() => expect(ui.getByLabelText('Private submission photo 1')).toBeTruthy());
    await act(async () => oldLoad());
    expect(ui.getByLabelText('Confirm rights and safety reviewed').props.accessibilityState.disabled).toBe(true);
    await fireEvent(ui.getByLabelText('Private submission photo 1'), 'load');
    expect(ui.getByLabelText('Confirm rights and safety reviewed').props.accessibilityState.disabled).toBe(false);
    expect(api.adminReviewBeyondPost).not.toHaveBeenCalled();
});
it('clears private preview on image failure and removes the approval action', async () => {
    (api.fetchAdminBeyondPosts as jest.Mock).mockResolvedValue({ posts: [post('one')], nextId: null, enabled: true });
    (api.signBeyondMedia as jest.Mock).mockResolvedValue({ url: 'https://private.invalid/preview', expiresAt: Date.now() + 60000 });
    const ui = await render(<BeyondGamePanel />);
    await waitFor(() => expect(ui.getByText('Preview submission one')).toBeTruthy());
    await fireEvent.press(ui.getByText('Preview submission one'));
    await waitFor(() => expect(ui.getByLabelText('Private submission photo 1')).toBeTruthy());
    await fireEvent(ui.getByLabelText('Private submission photo 1'), 'error');
    expect(ui.queryByText('Approve reviewed submission')).toBeNull();
    expect(ui.queryByLabelText('Private submission photo 1')).toBeNull();
});
it('refuses a retained approval callback after closing its exact preview', async () => {
    (api.fetchAdminBeyondStatus as jest.Mock).mockResolvedValue({ ...status, enabled: true });
    (api.fetchAdminBeyondPosts as jest.Mock).mockResolvedValue({ posts: [post('one')], nextId: null, enabled: true });
    (api.signBeyondMedia as jest.Mock).mockResolvedValue({ url: 'https://private.invalid/preview', expiresAt: Date.now() + 60000 });
    const ui = await render(<BeyondGamePanel />);
    await waitFor(() => expect(ui.getByText('Preview submission one')).toBeTruthy());
    await fireEvent.press(ui.getByText('Preview submission one'));
    await waitFor(() => expect(ui.getByLabelText('Private submission photo 1')).toBeTruthy());
    await fireEvent(ui.getByLabelText('Private submission photo 1'), 'load');
    await fireEvent.press(ui.getByLabelText('Confirm rights and safety reviewed'));
    await fireEvent.changeText(ui.getByLabelText('Review or switch reason'), 'Current review reason');
    const staleApprove = retainedPress(ui.getByLabelText('Approve reviewed submission'));
    await fireEvent.press(ui.getByText('Close private preview'));
    await act(async () => {
        staleApprove();
    });
    expect(api.adminReviewBeyondPost).not.toHaveBeenCalled();
});
it('refuses a retained removal callback after a new authoritative queue read', async () => {
    (api.fetchAdminBeyondPosts as jest.Mock).mockResolvedValue({ posts: [post('one')], nextId: null, enabled: true });
    const ui = await render(<BeyondGamePanel />);
    await waitFor(() => expect(ui.getByText('Remove submission one')).toBeTruthy());
    await fireEvent.changeText(ui.getByLabelText('Review or switch reason'), 'Current removal reason');
    const staleRemove = retainedPress(ui.getByLabelText('Remove submission one'));
    await fireEvent.press(ui.getByText('Refresh review queue'));
    await waitFor(() => expect(ui.getByText('Remove submission one')).toBeTruthy());
    await act(async () => {
        staleRemove();
    });
    expect(api.adminReviewBeyondPost).not.toHaveBeenCalled();
});
// RNTL14 host nodes expose the real callback through the retained React fiber; fireEvent intentionally ignores unmounted nodes.
function retainedPress(node: {
    unstable_fiber: unknown;
}): () => void {
    type Fiber = {
        memoizedProps?: {
            onPress?: () => void;
        };
        return?: Fiber | null;
    };
    let fiber = node.unstable_fiber as Fiber | null;
    for (let depth = 0; fiber && depth < 30; depth++, fiber = fiber.return ?? null) {
        if (typeof fiber.memoizedProps?.onPress === 'function') {
            return fiber.memoizedProps.onPress;
        }
    }
    throw new Error('Actual press handler not found');
}

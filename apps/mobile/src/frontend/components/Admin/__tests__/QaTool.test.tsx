/** QA repair sources must load independently and keep stale reads/actions from changing the current desk. */
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { QaTool } from '../QaTool';
import { dismissTelemetryIncident, fetchAdminTelemetryDigest } from '@/lib/admin';
import { offlineQueue } from '@/services/OfflineQueue';
import { telemetry } from '@/services/TelemetryManager';

jest.mock('expo-router', () => ({
  useFocusEffect: (callback: () => void) => require('react').useEffect(callback, [callback]),
}));
jest.mock('@/components/Admin/AdminChrome', () => {
  const React = require('react');
  const { View, Text, Pressable } = require('react-native');
  const container = ({ children, title, text }: { children?: React.ReactNode; title?: string; text?: string }) =>
    React.createElement(View, null, title && React.createElement(Text, null, title), text && React.createElement(Text, null, text), children);
  return {
    AdminPage: ({ children, error, onRefresh }: { children: React.ReactNode; error?: string; onRefresh: () => void }) =>
      React.createElement(View, null, error && React.createElement(Text, null, error),
        React.createElement(Pressable, { accessibilityRole: 'button', accessibilityLabel: 'Refresh QA', onPress: onRefresh }, React.createElement(Text, null, 'Refresh QA')), children),
    AdminPanel: container, AdminEmpty: container, AdminNotice: container,
    AdminSectionTitle: ({ children }: { children: React.ReactNode }) => React.createElement(Text, null, children),
    AdminDeskLink: container,
    AdminRow: ({ title, meta, children }: { title: string; meta?: string; children?: React.ReactNode }) =>
      React.createElement(View, null, React.createElement(Text, null, title), meta && React.createElement(Text, null, meta), children),
    AdminBtn: ({ label, onPress, disabled }: { label: string; onPress: () => void; disabled?: boolean }) =>
      React.createElement(Pressable, { accessibilityRole: 'button', accessibilityLabel: label, onPress, disabled, accessibilityState: { disabled: !!disabled } }, React.createElement(Text, null, label)),
  };
});
jest.mock('@/lib/admin', () => ({ fetchAdminTelemetryDigest: jest.fn(), dismissTelemetryIncident: jest.fn() }));
jest.mock('@/services/OfflineQueue', () => ({ offlineQueue: { snapshot: jest.fn(), getIsConnected: jest.fn(), flush: jest.fn(), discardAll: jest.fn() } }));
jest.mock('@/services/TelemetryManager', () => ({ telemetry: { getHealth: jest.fn(() => ({
  phase: 'unknown', queued: 0, inFlight: 0, capacity: 120, batchSize: 15, timeoutMs: 10000,
  accepted: 0, delivered: 0, dropped: 0, uncertain: 0, lastFailure: null,
  lastDeliveredAt: null, lastFailureAt: null,
})) } }));

const digest = { recent: [{ id: 'event-1', title: 'Synthetic stall', subtitle: 'Highlights', durationMs: 200, createdAt: '2026-10-14T00:00:00Z' }], error: null };
const action = { id: 'queued-1', type: 'bookmark' as const, saved: true, userId: 'fixture-fan', reelId: 'fixture-reel', created_at: '2026-10-14T00:00:00Z' };
const deferred = <T,>() => {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
};

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(fetchAdminTelemetryDigest).mockReset().mockResolvedValue(digest as never);
  jest.mocked(dismissTelemetryIncident).mockReset().mockResolvedValue(undefined);
  jest.mocked(offlineQueue.snapshot).mockReset().mockResolvedValue([action] as never);
  jest.mocked(offlineQueue.getIsConnected).mockReturnValue(true);
  jest.mocked(offlineQueue.flush).mockReset().mockResolvedValue(undefined);
  jest.mocked(offlineQueue.discardAll).mockReset().mockResolvedValue(undefined);
});

it('keeps the device queue available when the telemetry read fails', async () => {
  jest.mocked(fetchAdminTelemetryDigest).mockRejectedValue(new Error('Telemetry source unavailable.'));
  await render(<QaTool />);
  expect(screen.getByText('Save clip · fixture-')).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Flush now' })).toBeEnabled();
  expect(screen.getByText('Telemetry source unavailable.')).toBeTruthy();
});

it('keeps telemetry visible when the independent device queue read fails', async () => {
  jest.mocked(offlineQueue.snapshot).mockRejectedValue(new Error('Device queue unavailable.'));
  await render(<QaTool />);
  expect(screen.getByText('Synthetic stall')).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Flush now' })).toBeDisabled();
});

it('finishes the queue read without waiting for a hanging telemetry source', async () => {
  const source = deferred<typeof digest>();
  jest.mocked(fetchAdminTelemetryDigest).mockReturnValue(source.promise as never);
  const view = await render(<QaTool />);
  expect(screen.getByText('Save clip · fixture-')).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Flush now' })).toBeEnabled();
  await view.unmount();
  await act(async () => source.resolve(digest));
});

it('bounds unresolved source reads across refresh and ignores the old response', async () => {
  const old = deferred<typeof digest>();
  jest.mocked(fetchAdminTelemetryDigest).mockReturnValueOnce(old.promise as never);
  await render(<QaTool />);
  await fireEvent.press(screen.getByRole('button', { name: 'Refresh QA' }));
  expect(fetchAdminTelemetryDigest).toHaveBeenCalledTimes(1);
  await act(async () => old.resolve({ ...digest, recent: [{ ...digest.recent[0], title: 'Old response' }] }));
  expect(screen.queryByText('Old response')).toBeNull();
  await fireEvent.press(screen.getByRole('button', { name: 'Refresh QA' }));
  expect(screen.getByText('Synthetic stall')).toBeTruthy();
});

it('does not start follow-up reads when an incident action finishes after unmount', async () => {
  const done = deferred<void>();
  jest.mocked(dismissTelemetryIncident).mockReturnValue(done.promise);
  const view = await render(<QaTool />);
  await fireEvent.press(screen.getByRole('button', { name: 'Dismiss' }));
  await view.unmount();
  await act(async () => done.resolve());
  expect(fetchAdminTelemetryDigest).toHaveBeenCalledTimes(1);
});

it('reports a replay attempt honestly when actions remain in the device queue', async () => {
  await render(<QaTool />);
  await fireEvent.press(screen.getByRole('button', { name: 'Flush now' }));
  expect(screen.queryByText('Offline queue flushed.')).toBeNull();
  expect(screen.getByText('Replay checked: 1 action remains on this device.')).toBeTruthy();
});

it('shows local delivery uncertainty without presenting it as fleet health', async () => {
  await render(<QaTool />);
  expect(screen.getByText('Telemetry delivery · this device')).toBeTruthy();
  expect(screen.getByText('No delivery has been confirmed in this session.')).toBeTruthy();
  expect(screen.queryByText('Healthy')).toBeNull();
});

it('keeps historical loss visible after a newer batch succeeds', async () => {
  const getter = jest.mocked(telemetry.getHealth);
  const initial = getter();
  getter.mockReturnValueOnce({ ...initial, phase: 'delivered', delivered: 3, dropped: 2, uncertain: 2,
    lastFailure: 'timeout', lastFailureAt: '2026-10-14T00:00:00Z', lastDeliveredAt: '2026-10-14T00:01:00Z' })
    .mockReturnValueOnce({ ...initial, phase: 'delivered', delivered: 3, dropped: 2, uncertain: 2,
      lastFailure: 'timeout', lastFailureAt: '2026-10-14T00:00:00Z', lastDeliveredAt: '2026-10-14T00:01:00Z' });
  await render(<QaTool />);
  expect(screen.getByText('The latest telemetry batch was confirmed.')).toBeTruthy();
  expect(screen.getByText('2 total · 2 uncertain')).toBeTruthy();
  expect(screen.getByText('Delivery timed out · 2026-10-14 00:00:00 UTC')).toBeTruthy();
});

it('shows unknown delivery instead of crashing when hot reload retains an older logger', async () => {
  const getter = telemetry.getHealth;
  Object.assign(telemetry, { getHealth: undefined });
  try {
    await render(<QaTool />);
    expect(screen.getByText('Reload the app to load telemetry delivery monitoring.')).toBeTruthy();
    expect(screen.queryByText('Confirmed events')).toBeNull();
  } finally { Object.assign(telemetry, { getHealth: getter }); }
});

it('times out a stuck source and ignores its later success', async () => {
  jest.useFakeTimers();
  const source = deferred<typeof digest>();
  jest.mocked(fetchAdminTelemetryDigest).mockReturnValue(source.promise as never);
  try {
    await render(<QaTool />);
    await act(async () => { await jest.advanceTimersByTimeAsync(10000); });
    expect(screen.getByText('Client events could not be read within 10 seconds.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Flush now' })).toBeEnabled();
    await act(async () => source.resolve(digest));
    expect(screen.queryByText('Synthetic stall')).toBeNull();
    expect(screen.getByText('Client events could not be read within 10 seconds.')).toBeTruthy();
  } finally { jest.useRealTimers(); }
});

it('names clear and unsave actions accurately in the repair queue', async () => {
  jest.mocked(offlineQueue.snapshot).mockResolvedValue([
    { ...action, id: 'clear-1', type: 'hype_clear', kind: 'seki' },
    { ...action, id: 'unsave-1', saved: false },
  ] as never);
  await render(<QaTool />);
  expect(screen.getByText('Clear seki · fixture-')).toBeTruthy();
  expect(screen.getByText('Unsave clip · fixture-')).toBeTruthy();
  expect(screen.queryByText('Report · fixture-')).toBeNull();
});

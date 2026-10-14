/** Exact private-video readiness/ownership with synthetic supported Expo events; no browser/device playback claim. */
import { useState } from 'react';
import { AppState, Platform, Pressable, Text, type AppStateStatus } from 'react-native';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { FanZoneVideo } from '../FanZoneVideo';
import { loadFanZoneVideo } from '@/lib/fanZoneMedia';
import type { VideoSource } from 'expo-video';
let mockFocused = true;
type Player = { source: VideoSource; status: string; play: jest.Mock; pause: jest.Mock; release: jest.Mock; listeners: Set<(event: { status: string }) => void> };
const mockPlayers: Player[] = [];
const mockViews: { player: Player; onFirstFrameRender: () => void }[] = [];
jest.mock('expo-router', () => ({ useIsFocused: () => mockFocused }));
jest.mock('@/lib/fanZoneMedia', () => ({ loadFanZoneVideo: jest.fn() }));
jest.mock('expo-video', () => ({
  useVideoPlayer: (source: VideoSource, setup: (p: Player) => void) => {
    const React = require('react');
    const player = React.useMemo(() => {
      const p = { source, status: 'loading', play: jest.fn(), pause: jest.fn(), release: jest.fn(), listeners: new Set<(mockEvent: { status: string }) => void>(),
        addListener: (_name: string, listener: (mockEvent: { status: string }) => void) => { p.listeners.add(listener); return { remove: () => p.listeners.delete(listener) }; } };
      setup?.(p); mockPlayers.push(p); return p;
    }, [source]);
    React.useEffect(() => () => player.release(), [player]);
    return player;
  },
  VideoView: (props: { player: Player; onFirstFrameRender: () => void }) => { const { Text } = require('react-native'); mockViews.push(props); return <Text>Exact private video attached</Text>; },
}));
const released = jest.fn();
function Harness({ target = 'review-a', entryId = 'entry-a', revision = 1 }: { target?: string; entryId?: string; revision?: number }) {
  const [open, setOpen] = useState(false);
  const [ready, setReady] = useState<string | null>(null);
  return <>
    <FanZoneVideo entryId={entryId} revision={revision} reviewKey={target} open={open} onOpen={() => setOpen(true)} onClose={() => setOpen(false)}
      onReady={(key, yes) => { if (key === target) setReady(yes ? target : null); }} />
    <Pressable accessibilityRole="button" accessibilityLabel="Confirm exact review" disabled={ready !== target}><Text>Confirm exact review</Text></Pressable>
  </>;
}
function latest() { return mockPlayers[mockPlayers.length - 1]; }
async function status(value: string, p = latest()) { await act(async () => { p.status = value; for (const listener of [...p.listeners]) listener({ status: value }); }); }
async function frame(view = mockViews[mockViews.length - 1]) { await act(async () => { view.onFirstFrameRender(); }); }
const locked = () => expect(screen.getByRole('button', { name: 'Confirm exact review' })).toBeDisabled();
const ready = () => expect(screen.getByRole('button', { name: 'Confirm exact review' })).toBeEnabled();
beforeEach(() => { jest.clearAllMocks(); mockFocused = true; mockPlayers.length = 0; mockViews.length = 0; Object.defineProperty(AppState, 'currentState', { value: 'active', writable: true, configurable: true });
  jest.mocked(loadFanZoneVideo).mockResolvedValue({ source: { uri: 'blob:private' }, release: released }); });
afterEach(() => jest.restoreAllMocks());

it('loads only after explicit Open and owns one uncached player until Close', async () => {
  await render(<Harness />); locked(); expect(loadFanZoneVideo).not.toHaveBeenCalled();
  await fireEvent.press(screen.getByRole('button', { name: 'Open private video' }));
  await screen.findByText('Exact private video attached');
  expect(loadFanZoneVideo).toHaveBeenCalledWith('entry-a', 1, expect.any(AbortSignal));
  expect(mockPlayers).toHaveLength(1); expect(latest().source).toMatchObject({ uri: 'blob:private', useCaching: false });
  await fireEvent.press(screen.getByRole('button', { name: 'Close private video' }));
  expect(screen.queryByText('Exact private video attached')).toBeNull(); locked();
  expect(latest().pause).toHaveBeenCalled(); expect(latest().release).toHaveBeenCalledTimes(1); expect(released).toHaveBeenCalledTimes(1);
});
it.each(['ios', 'web'])('%s requires both documented first-frame and readyToPlay evidence', async platform => {
  Object.defineProperty(Platform, 'OS', { value: platform, configurable: true });
  await render(<Harness />); await fireEvent.press(screen.getByRole('button', { name: 'Open private video' })); await screen.findByText('Exact private video attached');
  await status('readyToPlay'); locked(); await frame(); ready();
  await status('loading'); locked(); await status('readyToPlay'); ready();
});
it('first frame before readyToPlay does not prematurely enable review', async () => {
  await render(<Harness />); await fireEvent.press(screen.getByRole('button', { name: 'Open private video' })); await screen.findByText('Exact private video attached');
  await frame(); locked(); await status('readyToPlay'); ready();
});
it('new identity/revision/digest scope cannot inherit old readiness or a late old-frame callback', async () => {
  const view = await render(<Harness />); await fireEvent.press(screen.getByRole('button', { name: 'Open private video' })); await screen.findByText('Exact private video attached');
  await status('readyToPlay'); await frame(); ready(); const old = latest(), oldView = mockViews[mockViews.length - 1];
  await view.rerender(<Harness target="review-b-new-digest" entryId="entry-b" revision={2} />); locked(); await screen.findByText('Exact private video attached');
  expect(old.pause).toHaveBeenCalled(); expect(old.release).toHaveBeenCalledTimes(1);
  await status('readyToPlay'); locked(); await frame(oldView); locked(); await frame(); ready();
});
it('aborts pending close and releases late browser bytes without attaching them', async () => {
  let finish!: (v: Awaited<ReturnType<typeof loadFanZoneVideo>>) => void;
  jest.mocked(loadFanZoneVideo).mockImplementation(() => new Promise(resolve => { finish = resolve; }));
  await render(<Harness />); await fireEvent.press(screen.getByRole('button', { name: 'Open private video' }));
  const signal = jest.mocked(loadFanZoneVideo).mock.calls[0][2]!;
  await fireEvent.press(screen.getByRole('button', { name: 'Close private video' })); expect(signal.aborted).toBe(true);
  await act(async () => { finish({ source: { uri: 'blob:late' }, release: released }); });
  expect(released).toHaveBeenCalledTimes(1); expect(mockPlayers).toHaveLength(0); locked();
});
it('a late previous-target load cannot attach to the new scope', async () => {
  let finish!: (v: Awaited<ReturnType<typeof loadFanZoneVideo>>) => void; const oldRelease = jest.fn();
  jest.mocked(loadFanZoneVideo).mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
  const view = await render(<Harness />); await fireEvent.press(screen.getByRole('button', { name: 'Open private video' }));
  await view.rerender(<Harness target="review-b" entryId="entry-b" revision={2} />); await screen.findByText('Exact private video attached');
  await act(async () => { finish({ source: { uri: 'blob:old' }, release: oldRelease }); });
  expect(oldRelease).toHaveBeenCalledTimes(1); expect(mockPlayers).toHaveLength(1); expect(latest().source).toMatchObject({ uri: 'blob:private' }); locked();
});
it('background revokes readiness, pauses/releases bytes and requires another explicit Open', async () => {
  let change!: (state: AppStateStatus) => void;
  jest.spyOn(AppState, 'addEventListener').mockImplementation((_name, listener) => { change = listener; return { remove: jest.fn() }; });
  await render(<Harness />); await fireEvent.press(screen.getByRole('button', { name: 'Open private video' })); await screen.findByText('Exact private video attached');
  await status('readyToPlay'); await frame(); ready();
  await act(async () => { change('background'); }); locked(); expect(released).toHaveBeenCalledTimes(1);
  await act(async () => { change('active'); }); expect(screen.getByRole('button', { name: 'Open private video' })).toBeTruthy(); expect(mockPlayers).toHaveLength(1);
});
it('leaving route revokes readiness/releases the sole player without reopening on return', async () => {
  const view = await render(<Harness />); await fireEvent.press(screen.getByRole('button', { name: 'Open private video' })); await screen.findByText('Exact private video attached');
  await status('readyToPlay'); await frame(); ready(); mockFocused = false; await view.rerender(<Harness />); locked();
  expect(released).toHaveBeenCalledTimes(1); mockFocused = true; await view.rerender(<Harness />); expect(mockPlayers).toHaveLength(1);
});
it('unmount aborts and releases loaded bytes exactly once, ignoring stale render/status evidence', async () => {
  const callback = jest.fn(); const view = await render(<FanZoneVideo entryId="entry" revision={1} reviewKey="old" open onOpen={jest.fn()} onClose={jest.fn()} onReady={callback} />);
  await screen.findByText('Exact private video attached'); const old = latest(), oldView = mockViews[mockViews.length - 1]; await status('readyToPlay'); await frame();
  await view.unmount(); const trueCount = callback.mock.calls.filter(c => c[1] === true).length;
  await frame(oldView); await status('readyToPlay', old);
  expect(callback.mock.calls.filter(c => c[1] === true)).toHaveLength(trueCount); expect(callback).toHaveBeenLastCalledWith('old', false); expect(released).toHaveBeenCalledTimes(1);
});
it('load failure stays private and never substitutes public/token URL content', async () => {
  jest.mocked(loadFanZoneVideo).mockRejectedValue(new Error('secret-token/private-path'));
  await render(<Harness />); await fireEvent.press(screen.getByRole('button', { name: 'Open private video' }));
  expect(await screen.findByText('Private video is unavailable. Close and try again, or refresh Fan Zone.')).toBeTruthy();
  expect(screen.queryByText(/secret-token/)).toBeNull(); expect(mockPlayers).toHaveLength(0); locked();
});
it('playback error revokes review and releases private bytes with a safe error', async () => {
  await render(<Harness />); await fireEvent.press(screen.getByRole('button', { name: 'Open private video' })); await screen.findByText('Exact private video attached');
  await status('readyToPlay'); await frame(); ready(); await status('error'); locked();
  expect(screen.getByText('Private video playback is unavailable. Close and try again, or refresh Fan Zone.')).toBeTruthy();
  expect(screen.queryByText('Exact private video attached')).toBeNull(); expect(released).toHaveBeenCalledTimes(1);
});
it('keeps native bearer headers in the source object while disabling caching', async () => {
  jest.mocked(loadFanZoneVideo).mockResolvedValue({ source: { uri: 'https://example.test/api/fan-zone-media?entry=e&revision=1', headers: { Authorization: 'Bearer test-value' }, contentType: 'progressive' }, release: released });
  await render(<Harness />); await fireEvent.press(screen.getByRole('button', { name: 'Open private video' })); await screen.findByText('Exact private video attached');
  expect(latest().source).toMatchObject({ headers: { Authorization: 'Bearer test-value' }, useCaching: false });
  expect((latest().source as { uri: string }).uri).not.toContain('Bearer'); locked();
});

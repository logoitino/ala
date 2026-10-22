/** Dock scroll composition must leave the existing deepest-scroll and dwell telemetry unchanged. */
import { act, renderHook } from '@testing-library/react-native';
import { type ReactNode } from 'react';
import { FanNavigationProvider, useFanDockSoftened } from '@/context/FanNavigationContext';
import { useSurfaceUsage } from '../useSurfaceUsage';
import { telemetry } from '@/services/TelemetryManager';
let mockPath = '/local';
let mockFocused = true;
jest.mock('expo-router', () => ({
  usePathname: () => mockPath,
  useFocusEffect: (callback: () => (() => void)) => require('react').useEffect(() => mockFocused ? callback() : undefined, [callback, mockFocused]),
}));
jest.mock('@/services/TelemetryManager', () => ({ telemetry: { trackFeature: jest.fn(), trackTabDwell: jest.fn(), trackScroll: jest.fn(), trackIssue: jest.fn() } }));
const wrapper = ({ children }: { children: ReactNode }) => <FanNavigationProvider>{children}</FanNavigationProvider>;
beforeEach(() => { jest.useFakeTimers(); jest.clearAllMocks(); mockPath = '/local'; mockFocused=true; });
afterEach(() => jest.useRealTimers());

it('restores backdrop on stop/focus and reports the same maximum native scroll percentage', async () => {
  const { result, rerender, unmount } = await renderHook(() => ({ ...useSurfaceUsage('local'), softened: useFanDockSoftened() }), { wrapper });
  const event = (y: number) => ({ nativeEvent: { contentOffset: { y }, contentSize: { height: 1000 }, layoutMeasurement: { height: 500 } } }) as any;
  await act(() => result.current.onScroll(event(0)));
  await act(() => { jest.advanceTimersByTime(80); result.current.onScroll(event(200)); });
  expect(result.current.softened).toBe(true);
  await act(() => { jest.advanceTimersByTime(650); });
  expect(result.current.softened).toBe(false);
  await act(() => result.current.onScroll(event(400)));
  expect(result.current.softened).toBe(true);
  mockPath = '/spotlight'; await rerender({});
  expect(result.current.softened).toBe(false);
  await unmount();
  expect(telemetry.trackScroll).toHaveBeenCalledWith('local', 80);
  expect(telemetry.trackTabDwell).toHaveBeenCalledTimes(1);
  expect(telemetry.trackFeature).toHaveBeenCalledWith('tab.local', 'local');
});

it('handles paged Highlights percentages with idle recovery and the same telemetry maximum', async () => {
  const { result, unmount } = await renderHook(() => ({ ...useSurfaceUsage('home'), softened: useFanDockSoftened() }), { wrapper });
  await act(() => result.current.noteScrollPct(0));
  await act(() => { jest.advanceTimersByTime(80); result.current.noteScrollPct(50); });
  expect(result.current.softened).toBe(true);
  await act(() => { jest.advanceTimersByTime(650); });
  expect(result.current.softened).toBe(false);
  await act(() => result.current.noteScrollPct(20));
  expect(result.current.softened).toBe(false);
  await unmount();
  expect(telemetry.trackScroll).toHaveBeenCalledWith('home', 50);
});

it('keeps role screens without a fan provider inert', async () => {
  const { result, unmount } = await renderHook(() => ({ ...useSurfaceUsage('profile'), softened: useFanDockSoftened() }));
  await act(() => { result.current.noteScrollPct(0); result.current.noteScrollPct(100); });
  expect(result.current.softened).toBe(false);
  await unmount();
  expect(telemetry.trackScroll).toHaveBeenCalledWith('profile', 100);
});

it('rejects captured native and paged callbacks from an inactive mounted route', async () => {
  const { result, rerender, unmount } = await renderHook(() => ({ ...useSurfaceUsage('home'), softened: useFanDockSoftened() }), { wrapper });
  const oldPaged = result.current.noteScrollPct;
  const oldNative = result.current.onScroll;
  await act(() => oldPaged(0));
  mockFocused=false; mockPath='/local'; await rerender({});
  await act(() => { oldPaged(20); jest.advanceTimersByTime(80); oldPaged(70); });
  await act(() => { oldNative({ nativeEvent: { contentOffset: { y: 100 }, contentSize: { height: 1000 }, layoutMeasurement: { height: 500 } } } as any); });
  expect(result.current.softened).toBe(false);
  await unmount();
});

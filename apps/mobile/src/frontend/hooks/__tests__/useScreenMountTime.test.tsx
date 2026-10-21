/** Screen-mount timing emits once per mount while the smoothness flag is on (even when the flag
 * arrives after mount), and stays silent while off or when layouts are missing. */
import { renderHook } from '@testing-library/react-native';
import { useScreenMountTime } from '../useScreenMountTime';
import { telemetry } from '@/services/TelemetryManager';

let mockLive: { layouts?: { telemetrySmoothness?: boolean } } = { layouts: { telemetrySmoothness: false } };
jest.mock('@/context/AppRuntimeContext', () => ({ useAppRuntime: () => ({ live: mockLive }) }));

let mountSpy: jest.SpyInstance;
beforeEach(() => {
  mountSpy = jest.spyOn(telemetry, 'trackScreenMount').mockImplementation(() => { });
});
afterEach(() => {
  jest.restoreAllMocks();
  mockLive = { layouts: { telemetrySmoothness: false } };
});

it('emits one screen_mount with the surface and a non-negative duration when the flag is on', async () => {
  mockLive = { layouts: { telemetrySmoothness: true } };
  const r = await renderHook(() => useScreenMountTime('home'));
  await r.rerender({});
  expect(mountSpy).toHaveBeenCalledTimes(1);
  expect(mountSpy).toHaveBeenCalledWith('home', expect.any(Number));
  expect(mountSpy.mock.calls[0][1]).toBeGreaterThanOrEqual(0);
});

it('stays silent while the flag is off or layouts are missing', async () => {
  mockLive = { layouts: { telemetrySmoothness: false } };
  const r = await renderHook(() => useScreenMountTime('home'));
  await r.unmount();
  mockLive = {};
  await renderHook(() => useScreenMountTime('home'));
  expect(mountSpy).not.toHaveBeenCalled();
});

it('emits late when the flag arrives after mount, without measuring flag latency twice', async () => {
  mockLive = { layouts: { telemetrySmoothness: false } };
  const r = await renderHook(() => useScreenMountTime('sport-quiz'));
  expect(mountSpy).not.toHaveBeenCalled();
  mockLive = { layouts: { telemetrySmoothness: true } };
  await r.rerender({});
  expect(mountSpy).toHaveBeenCalledTimes(1);
  expect(mountSpy).toHaveBeenCalledWith('sport-quiz', expect.any(Number));
});

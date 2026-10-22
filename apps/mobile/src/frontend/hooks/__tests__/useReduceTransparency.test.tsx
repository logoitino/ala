/** Live accessibility changes must keep the dock solid, including late initial device reads. */
import { act, renderHook } from '@testing-library/react-native';
import { AccessibilityInfo, Platform } from 'react-native';
import { useReduceTransparency } from '../useReduceTransparency';

it('uses a solid unknown/unsupported fallback and follows live changes over a late read', async () => {
  let resolve!: (value: boolean) => void;
  let change!: (value: boolean) => void;
  const remove = jest.fn();
  jest.spyOn(AccessibilityInfo, 'isReduceTransparencyEnabled').mockImplementation(() => new Promise<boolean>(done => { resolve = done; }));
  jest.spyOn(AccessibilityInfo, 'addEventListener').mockImplementation((event, handler) => {
    if (event === 'reduceTransparencyChanged') change = handler as (value: boolean) => void;
    return { remove };
  });
  const { result, unmount } = await renderHook(useReduceTransparency);
  expect(result.current).toBe(true);
  await act(() => change(true));
  await act(async () => { resolve(false); await Promise.resolve(); });
  expect(result.current).toBe(true);
  await act(() => change(false));
  expect(result.current).toBe(false);
  await unmount();
  expect(remove).toHaveBeenCalledTimes(1);
  jest.restoreAllMocks();
});

it('follows the browser Reduce Transparency preference when native accessibility is unavailable', async () => {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'window');
  let change!: (event: { matches: boolean }) => void;
  const remove = jest.fn();
  jest.replaceProperty(Platform, 'OS', 'web');
  jest.spyOn(AccessibilityInfo, 'isReduceTransparencyEnabled').mockResolvedValue(false);
  Object.defineProperty(globalThis, 'window', { configurable: true, value: {
    matchMedia: () => ({ matches: true, addEventListener: (_event: string, handler: typeof change) => { change = handler; }, removeEventListener: remove }),
  } });
  try {
    const { result, unmount } = await renderHook(useReduceTransparency);
    expect(result.current).toBe(true);
    await act(() => change({ matches: false }));
    expect(result.current).toBe(false);
    await act(() => change({ matches: true }));
    expect(result.current).toBe(true);
    await unmount(); expect(remove).toHaveBeenCalledTimes(1);
  } finally {
    if (descriptor) Object.defineProperty(globalThis, 'window', descriptor);
    else Reflect.deleteProperty(globalThis, 'window');
    jest.restoreAllMocks();
  }
});

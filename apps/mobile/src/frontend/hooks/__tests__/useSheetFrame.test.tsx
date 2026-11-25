/** Workspace sizing is opt-in, responsive and never changes a native or unrelated sheet. */
import { renderHook } from '@testing-library/react-native';
import { Platform } from 'react-native';
import { useSheetFrame } from '@/hooks/useSheetFrame';
import { SheetPresentationContext } from '@/components/UI/SheetPresentationContext';

jest.mock('@/hooks/useAppViewport', () => ({ useAppViewportWidth: () => 680 }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ bottom: 0 }) }));
const dimensions = jest.spyOn(require('react-native'), 'useWindowDimensions');
const original = Platform.OS;
afterEach(() => { Object.defineProperty(Platform, 'OS', { configurable: true, value: original }); });

it.each(['ios', 'android'])('retains native %s geometry even inside a workspace provider', async os => {
  Object.defineProperty(Platform, 'OS', { configurable: true, value: os });
  dimensions.mockReturnValue({ width: 1400, height: 900, scale: 1, fontScale: 1 });
  const normal = await renderHook(useSheetFrame);
  const workspace = await renderHook(useSheetFrame, { wrapper: ({ children }) =>
    <SheetPresentationContext.Provider value="web-workspace">{children}</SheetPresentationContext.Provider> });
  expect(workspace.result.current).toEqual(normal.result.current);
  expect(workspace.result.current.card.maxWidth).toBe(440);
});

it('expands only scoped web sheets and fits tablet width', async () => {
  Object.defineProperty(Platform, 'OS', { configurable: true, value: 'web' });
  dimensions.mockReturnValue({ width: 900, height: 850, scale: 1, fontScale: 1 });
  const normal = await renderHook(useSheetFrame);
  const workspace = await renderHook(useSheetFrame, { wrapper: ({ children }) =>
    <SheetPresentationContext.Provider value="web-workspace">{children}</SheetPresentationContext.Provider> });
  expect(normal.result.current.card.maxWidth).toBe(440);
  expect(workspace.result.current.card.maxWidth).toBe(760);
  expect(workspace.result.current.dock.paddingHorizontal).toBe(70);
});

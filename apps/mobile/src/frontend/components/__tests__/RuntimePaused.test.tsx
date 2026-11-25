/** Web pause copy removes publishing mechanics while preserving operator guidance, native copy and recovery routing. */
import { fireEvent, render, screen } from '@testing-library/react-native';
import { Platform } from 'react-native';
import { RuntimePaused } from '@/components/RuntimePaused';

const mockReplace = jest.fn(), mockPush = jest.fn();
let mockAdmin = false;
jest.mock('expo-router', () => ({ useRouter: () => ({ replace: mockReplace, push: mockPush }) }));
jest.mock('@/context/AuthContext', () => ({ useAuth: () => ({ isAdmin: mockAdmin }) }));
jest.mock('@/context/AppRuntimeContext', () => ({ useAppRuntime: () => ({ live: {} }) }));
jest.mock('@/lib/runtime', () => ({ firstEnabledFanHref: () => '/activity' }));
jest.mock('@/hooks/useViewerSport', () => ({ useViewerSport: () => 'football' }));
jest.mock('@/components/Effects/SportField', () => ({ SportField: () => null }));
const original = Platform.OS;
afterEach(() => { Object.defineProperty(Platform, 'OS', { configurable: true, value: original }); mockAdmin = false; jest.clearAllMocks(); });
const setPlatform = (os: string) => Object.defineProperty(Platform, 'OS', { configurable: true, value: os });

it('gives web fans a clear recovery action without exposing operator guidance', async () => {
  setPlatform('web');
  await render(<RuntimePaused title="Drip is paused" lede="Publish in Features" />);
  expect(screen.getByText('This part of Tapua’i is currently unavailable. Please check back later.')).toBeTruthy();
  expect(screen.queryByText('Publish in Features')).toBeNull();
  expect(screen.queryByLabelText('Open Features')).toBeNull();
  await fireEvent.press(screen.getByLabelText('Return to app'));
  expect(mockReplace).toHaveBeenCalledWith('/activity');
});

it('retains the operator instruction and existing desk action on web', async () => {
  setPlatform('web'); mockAdmin = true;
  await render(<RuntimePaused title="Drip is paused" lede="Publish in Features" />);
  expect(screen.getByText('Publish in Features')).toBeTruthy();
  await fireEvent.press(screen.getByLabelText('Open Features'));
  expect(mockPush).toHaveBeenCalledWith('/admin/features');
});

it.each(['ios', 'android'])('retains the original %s fan copy and action', async os => {
  setPlatform(os);
  await render(<RuntimePaused title="Drip is paused" lede="Publish in Features" />);
  expect(screen.getByText('This surface is off right now. It comes back after Admin publishes it live.')).toBeTruthy();
  expect(screen.getByLabelText('Back to Home')).toBeTruthy();
});

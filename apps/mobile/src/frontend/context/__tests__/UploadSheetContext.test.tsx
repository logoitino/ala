/** Upload ＋ entry: chooser only while Beyond posting is on; Highlight and Beyond choices open the right composer. */
import { Text } from 'react-native';
import { act, render, screen } from '@testing-library/react-native';
import { UploadSheetProvider, useUploadSheet } from '../UploadSheetContext';
import { cloneAppRuntime, DEFAULT_APP_RUNTIME } from '@/lib/runtime';

const mockPush = jest.fn();
const mockRequireAuth = jest.fn();
let mockGuest = false;
let mockLive = cloneAppRuntime(DEFAULT_APP_RUNTIME);
jest.mock('expo-router', () => ({ router: { push: (href: string) => mockPush(href) } }));
jest.mock('@/context/AuthContext', () => ({ useAuth: () => ({ isGuest: mockGuest }) }));
jest.mock('@/context/SoftWallContext', () => ({ useSoftWall: () => ({ requireAuth: mockRequireAuth }) }));
jest.mock('@/context/AppRuntimeContext', () => ({ useAppRuntime: () => ({ live: mockLive }) }));

let api: ReturnType<typeof useUploadSheet>;
function Probe() {
  api = useUploadSheet();
  return <Text>{`sheet:${api.visible} chooser:${api.chooserVisible}`}</Text>;
}

beforeEach(() => {
  jest.clearAllMocks();
  mockGuest = false;
  mockLive = cloneAppRuntime(DEFAULT_APP_RUNTIME);
});

it('opens the Highlight composer straight away while Beyond posting is off', async () => {
  await render(<UploadSheetProvider><Probe /></UploadSheetProvider>);
  await act(async () => api.openUpload());
  expect(screen.getByText('sheet:true chooser:false')).toBeTruthy();
});

it('asks Highlight or Beyond while Beyond posting is on, then opens the chosen composer', async () => {
  mockLive.highlights.beyondGameEnabled = true;
  await render(<UploadSheetProvider><Probe /></UploadSheetProvider>);
  await act(async () => api.openUpload());
  expect(screen.getByText('sheet:false chooser:true')).toBeTruthy();
  await act(async () => api.openHighlightUpload());
  expect(screen.getByText('sheet:true chooser:false')).toBeTruthy();
  await act(async () => { api.closeUpload(); api.openUpload(); });
  await act(async () => api.openBeyondComposer());
  expect(screen.getByText('sheet:false chooser:false')).toBeTruthy();
  expect(mockPush).toHaveBeenCalledWith('/beyond?compose=1');
});

it('skips the chooser when Beyond is paused even if posting is switched on', async () => {
  mockLive.highlights.beyondGameEnabled = true;
  mockLive.tabs.beyond = false;
  await render(<UploadSheetProvider><Probe /></UploadSheetProvider>);
  await act(async () => api.openUpload());
  expect(screen.getByText('sheet:true chooser:false')).toBeTruthy();
});

it('sends guests to the account sheet first and resumes into the chooser', async () => {
  mockGuest = true;
  mockLive.highlights.beyondGameEnabled = true;
  await render(<UploadSheetProvider><Probe /></UploadSheetProvider>);
  await act(async () => api.openUpload());
  expect(screen.getByText('sheet:false chooser:false')).toBeTruthy();
  expect(mockRequireAuth).toHaveBeenCalledWith(expect.objectContaining({ kind: 'upload' }));
  await act(async () => mockRequireAuth.mock.calls[0][0].resume());
  expect(screen.getByText('sheet:false chooser:true')).toBeTruthy();
});

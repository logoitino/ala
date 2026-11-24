/** Viewer-photo tests guard against route/photo swaps exposing a previously opened image. */
import { fireEvent, render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';
import * as ImagePicker from 'expo-image-picker';

import { ProfileAvatarPicker } from '../ProfileAvatarPicker';
import { AVATAR_PICKER_LABEL } from '@/data/media';

jest.mock('@/context/AuthContext', () => ({ useAuth: () => ({ isGuest: false, refreshProfile: jest.fn() }) }));
jest.mock('@/context/SoftWallContext', () => ({ useSoftWall: () => ({ requireAuth: jest.fn() }) }));
jest.mock('@/services/MediaUploadService', () => ({ uploadAvatar: jest.fn() }));
jest.mock('@/services/TelemetryManager', () => ({ telemetry: { trackFeature: jest.fn() } }));
jest.mock('@/lib/haptics', () => ({ impactPress: jest.fn() }));
jest.mock('expo-image-picker', () => ({
  MediaTypeOptions: { Images: 'Images' },
  requestMediaLibraryPermissionsAsync: jest.fn(async () => ({ granted: true })),
  launchImageLibraryAsync: jest.fn(async () => ({ canceled: true })),
}));
jest.mock('react-native-safe-area-context', () => ({ SafeAreaView: jest.requireActual('react-native').View }));

const publicPhoto = 'https://image.invalid/public-photo.jpg';
const openLabel = 'View Ana’s profile photo';
const closeLabel = 'Close profile photo';

it('views only the already displayed photo and returns to the profile on Close', async () => {
  await render(<ProfileAvatarPicker uri={publicPhoto} previewName="Ana" size={64} />);
  await fireEvent.press(screen.getByRole('button', { name: openLabel }));
  const image = screen.getByRole('image', { name: 'Ana’s profile photo' });
  expect(image.props.source).toEqual({ uri: publicPhoto });
  await fireEvent.press(screen.getByRole('button', { name: closeLabel }));
  expect(screen.queryByRole('image', { name: 'Ana’s profile photo' })).toBeNull();
  expect(ImagePicker.requestMediaLibraryPermissionsAsync).not.toHaveBeenCalled();
});

it('closes the photo on subject change and does not offer a preview for initials', async () => {
  const view = await render(<ProfileAvatarPicker uri={publicPhoto} previewName="Ana" />);
  await fireEvent.press(screen.getByRole('button', { name: openLabel }));
  await view.rerender(<ProfileAvatarPicker uri={publicPhoto} previewName="Bea" />);
  expect(screen.queryByRole('button', { name: closeLabel })).toBeNull();
  expect(screen.getByRole('button', { name: 'View Bea’s profile photo' })).toBeTruthy();
  await view.rerender(<ProfileAvatarPicker uri={null} previewName="Bea"><Text>BE</Text></ProfileAvatarPicker>);
  expect(screen.getByText('BE')).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'View Bea’s profile photo' })).toBeNull();
});

it('keeps the owner’s existing picker instead of the visitor action', async () => {
  await render(<ProfileAvatarPicker editable uri={publicPhoto} previewName="Ana" />);
  expect(screen.queryByRole('button', { name: openLabel })).toBeNull();
  await fireEvent.press(screen.getByRole('button', { name: AVATAR_PICKER_LABEL }));
  expect(ImagePicker.launchImageLibraryAsync).toHaveBeenCalledTimes(1);
  expect(screen.queryByRole('button', { name: closeLabel })).toBeNull();
});

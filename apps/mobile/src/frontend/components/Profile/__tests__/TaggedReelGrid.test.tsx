/**
 * `TaggedReelGrid` posters (UX-05 grids): a photo story uses its cover photo and shows a `📷 5` badge with
 * a spoken label; video tiles keep the play poster and no photo badge.
 */
import { render, screen } from '@testing-library/react-native';

import { TaggedReelGrid } from '@/components/Profile/TaggedReelGrid';
import type { HighlightClip } from '@/data/highlights';

jest.mock('@/lib/haptics', () => ({ impactPress: jest.fn() }));
jest.mock('@/components/Reels/ReelViewModal', () => ({ ReelViewModal: () => null }));
jest.mock('expo-blur', () => {
  const { View } = jest.requireActual('react-native');
  return { BlurTargetView: View, BlurView: View };
});

const story: HighlightClip = {
  id: 's1',
  athleteName: 'Sione',
  school: 'ALA',
  tag: 'Service day',
  videoUrl: '',
  mediaType: 'photo_story',
  photoCount: 5,
  coverUrl: 'https://x/cover.jpg',
  createdAt: '2026-10-07T00:00:00Z',
};
const video: HighlightClip = {
  id: 'v1',
  athleteName: 'Sione',
  school: 'ALA',
  tag: 'Pick six',
  videoUrl: 'https://x/v.mp4',
  createdAt: '2026-10-06T00:00:00Z',
};

describe('TaggedReelGrid photo stories', () => {
  it('shows the cover and a 📷 5 badge with an accessible label', async () => {
    await render(<TaggedReelGrid clips={[story, video]} />);
    expect(screen.getByText('📷 5')).toBeTruthy();
    expect(screen.getByLabelText('Photo story, 5 photos')).toBeTruthy();
    expect(screen.getByLabelText('Service day, Photo story, 5 photos, Sione')).toBeTruthy();
    expect(screen.getByLabelText('Pick six clip, Sione')).toBeTruthy();
    const covers = screen.getAllByTestId('tile-cover');
    expect(covers.map((node) => node.props.source?.uri)).toEqual(['https://x/cover.jpg']);
  });

  it('does not load the cover on a locked Vault tile', async () => {
    await render(<TaggedReelGrid clips={[{ ...story, isVaultOnly: true }]} subscribed={false} />);
    expect(screen.queryAllByTestId('tile-cover')).toHaveLength(0);
    expect(screen.getByLabelText('Service day Photo story, 5 photos, One-time Exclusive 🔒')).toBeTruthy();
  });
});

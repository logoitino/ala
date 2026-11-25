/**
 * UPLOAD-STUDIO-01 upfront limits: the chips read the same constants the picker and Storage guard enforce, and a
 * clip that is already over the cap is refused at pick time only when nothing on the device will compress it.
 */
import { TurboModuleRegistry } from 'react-native';
import { render, screen } from '@testing-library/react-native';

import { UploadLimitChips, uploadLimits } from '@/components/Reels/UploadLimitChips';
import { PHOTO_STORY_MAX_PHOTOS } from '@/data/highlights';
import { HIGHLIGHT_MAX_BYTES, HIGHLIGHT_MAX_MB, HIGHLIGHT_MAX_SECONDS } from '@/data/media';
import { isHighlightTooBigAsPicked } from '@/services/MediaUploadService';

jest.mock('@expo/vector-icons/Ionicons', () => 'Ionicons');

afterEach(() => { jest.restoreAllMocks(); });

it('derives the video and photo limits from the enforced constants', () => {
  expect(HIGHLIGHT_MAX_MB).toBe(8);
  expect(uploadLimits('video').map((chip) => chip.text)).toEqual([`Up to ${HIGHLIGHT_MAX_SECONDS}s`, `Under ${HIGHLIGHT_MAX_MB} MB`, 'Vertical looks best']);
  expect(uploadLimits('photo_story')[0].text).toBe(`Up to ${PHOTO_STORY_MAX_PHOTOS} photos`);
});

it('reads all limits as one spoken summary', async () => {
  await render(<UploadLimitChips kind="video" />);
  expect(screen.getByLabelText('Limits: up to 45 seconds, under 8 megabytes, vertical video looks best.')).toBeTruthy();
});

it('refuses an oversized clip at pick time only when it will upload uncompressed', () => {
  const over = HIGHLIGHT_MAX_BYTES + 1;
  jest.spyOn(TurboModuleRegistry, 'get').mockReturnValue(null);
  expect(isHighlightTooBigAsPicked(over)).toBe(true);
  expect(isHighlightTooBigAsPicked(HIGHLIGHT_MAX_BYTES)).toBe(false);
  expect(isHighlightTooBigAsPicked(undefined)).toBe(false);
  jest.spyOn(TurboModuleRegistry, 'get').mockReturnValue({} as never);
  expect(isHighlightTooBigAsPicked(over)).toBe(false);
});

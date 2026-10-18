/** Max highlight length (seconds). Camera `videoMaxDuration` uses this. */
export const HIGHLIGHT_MAX_SECONDS = 45;

/** ImagePicker `duration` is milliseconds; this is the same cap. */
export const HIGHLIGHT_MAX_MS = HIGHLIGHT_MAX_SECONDS * 1000;

export const HIGHLIGHT_TOO_LONG =
  'Highlight clips must be 45 seconds or less to showcase your best plays!';

/** Hard stop before Storage. A compressed 45s clip at the upload bitrate stays under this. */
export const HIGHLIGHT_MAX_BYTES = 8 * 1024 * 1024;

export const HIGHLIGHT_TOO_BIG = 'This clip is too big to upload. Keep it under 8 MB.';

export const HIGHLIGHT_OPTIMIZING = 'Optimizing highlight quality...';

export const HIGHLIGHT_PICKER_TITLE = 'Pick a Highlight ⚡';
export const HIGHLIGHT_PICKER_LEDE = 'Camera roll, 45 seconds or less.';
export const HIGHLIGHT_LIBRARY_CTA = 'Choose from Camera Roll';

export const AVATAR_PICKER_LABEL = 'Change profile photo';
export const AVATAR_UPLOADING = 'Uploading photo…';

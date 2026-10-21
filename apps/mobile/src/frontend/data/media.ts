/** Max highlight length (seconds). Camera `videoMaxDuration` uses this. */
export const HIGHLIGHT_MAX_SECONDS = 45;

/** Upload DTOs use normalized milliseconds; picker seconds are converted at the web boundary. */
export const HIGHLIGHT_MAX_MS = HIGHLIGHT_MAX_SECONDS * 1000;

export const HIGHLIGHT_TOO_LONG =
  'Highlight clips must be 45 seconds or less to showcase your best plays!';

/** Unknown duration cannot establish that a picked clip meets the short-Highlight limit. */
export const HIGHLIGHT_LENGTH_UNREADABLE = 'Could not read this clip’s length. Pick it again.';

/** Hard stop before Storage. A compressed 45s clip at the upload bitrate stays under this. */
export const HIGHLIGHT_MAX_BYTES = 8 * 1024 * 1024;

export const HIGHLIGHT_TOO_BIG = 'This clip is too big to upload. Keep it under 8 MB.';

export const HIGHLIGHT_OPTIMIZING = 'Optimizing highlight quality...';

export const HIGHLIGHT_PICKER_TITLE = 'Pick a Highlight ⚡';
export const HIGHLIGHT_PICKER_LEDE = 'Camera roll, 45 seconds or less.';
export const HIGHLIGHT_LIBRARY_CTA = 'Choose from Camera Roll';

export const AVATAR_PICKER_LABEL = 'Change profile photo';
export const AVATAR_UPLOADING = 'Uploading photo…';

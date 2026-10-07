# Highlights and uploading

Feed/player overlays and Highlight composition belong here. Generic UI stays in `components/UI`;
Storage/compression stays in `services/MediaUploadService` and data calls in `lib/reels`.

- `UploadVideoModal.tsx`: owns the draft (video clip and photo-story photos, kept separately), clip and photo picking,
  required-field checks, upload lock and result handling. Videos publish through `lib/reels`; photo stories through
  `lib/photoStories` (`createPhotoStory`).
- `UploadVideoComposer.tsx`: renders Media / Details / Review, optional settings, searchable selections and fixed navigation.
- `PhotoStoryPicker.tsx`: the Video | Photos switch, the photo strip (Move earlier / Move later / Remove, 44-point,
  position-named labels) and optional per-photo descriptions (≤ 200 characters). Presentation only.
- `HighlightPickerModal.tsx`: existing library selection/compression flow.
- `AccountTagField.tsx`: optional mentions; their confirmation does not change the donation recipient.

Back preserves the draft. Replacing footage clears its rights confirmations; every applicable
confirmation remains mandatory.

Photo stories (`docs/engineering/design/PHOTO_STORIES_DESIGN.md`): Photos shows only when
`photoStoriesAvailable()` finds the SQL. Up to 10 photos, picked with `exif: false` and `quality: 0.85`;
`MediaUploadService.uploadStoryPhoto` re-encodes when the native compressor exists and always strips JPEG
metadata (`stripJpegMetadata`) before upload, refusing files it cannot clean. EXIF Orientation is the one
value kept: when it is not 1, a minimal APP1 holding only that tag is written back so rotated phone photos
still display upright; GPS, camera and everything else stay removed.

The database stores Storage **paths**, never URLs: photos upload (no overwrite) to
`reels/{uid}/stories/{reel_id}/{position}-{timestamp}.jpg`, `set_reel_photos` receives `image_path` and
checks that exact shape, and readers turn paths into URLs with `storyPhotoPublicUrl` (`lib/photoStories`).
`set_reel_photos` is publish-once (it only succeeds while `photo_count = 0`). Nothing is visible unless every
photo uploads and the RPC succeeds; on failure `createPhotoStory` throws `PhotoStoryPublishError` with the
hidden reel id, the modal keeps the draft and that id, and Retry reuses the same reel (caption and category
refreshed). A changed athlete or game starts a new reel, because those columns are fixed after insert; the
id is cleared when the story publishes or the sheet closes.

Photo stories use the photo rights wording (`PHOTO_RIGHTS_CHECKS`) and are public only (no Vault control).
Switching Video ↔ Photos keeps both drafts and clears only the confirmations. Adding photos clears
confirmations; reordering, removing and describing do not.

Never show a retryable upload failure for a clip already published
when only optional mentions failed. Keep each screen short and the primary button outside scrolling
content; verify small phones, keyboards and large text on a real device.

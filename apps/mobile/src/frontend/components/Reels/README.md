# Highlights and uploading

Feed/player overlays and Highlight composition belong here. Generic UI stays in `components/UI`;
Storage/compression stays in `services/MediaUploadService` and data calls in `lib/reels`.

- `UploadVideoModal.tsx`: owns the draft, clip picking, required-field checks, upload lock and result handling.
- `UploadVideoComposer.tsx`: renders Video / Details / Review, optional settings, searchable selections and fixed navigation.
- `HighlightPickerModal.tsx`: existing library selection/compression flow.
- `AccountTagField.tsx`: optional mentions; their confirmation does not change the donation recipient.

Back preserves the draft. Replacing footage clears its rights confirmations; every applicable
confirmation remains mandatory. Never show a retryable upload failure for a clip already published
when only optional mentions failed. Keep each screen short and the primary button outside scrolling
content; verify small phones, keyboards and large text on a real device.

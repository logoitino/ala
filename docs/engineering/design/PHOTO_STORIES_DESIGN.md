# Photo stories in Highlights ⚡ — design and build contract

**Status:** approved by the owner 2026-10-07; build in progress (WORK_QUEUE `UX-05`). Migration
not applied anywhere until DATABASE_MIGRATIONS and RLS_SECURITY sign off.

## Why

Highlights today are video only. Athletes' lives between games — volunteering, practice, family,
teammates, community — are often a few photos, not a clip. Photo stories let families show the
whole journey and let the community take part, through the same donate flow.

**Message (owner-approved):** **Donate. Elevate. Celebrate.** — *Support their journey. Elevate
their opportunities. Celebrate their story.* Placement: welcome overlay, donate sheet header,
athlete profile donate area, public docs and store copy. "Elevate their opportunities" must never
promise recruiting, scholarships or exposure outcomes (LEGAL row added with this feature).

## What users get

- **One photo or a swipeable story** of up to **10** photos, which the uploader can reorder before
  publishing.
- **Athlete tag** (required) — the story opens the athlete's profile exactly like a clip.
- **Caption** (required, existing `reels.title`) plus an optional **description per photo** (≤ 200
  characters).
- **Categories:** **Game Day**, Train Like Me, Serve Like Me. The owner renamed the label
  "Game Play" → **"Game Day"** for videos and photos alike on 2026-10-07; the stored value stays
  `game_play`, so no data migration.
- **Donate to the featured athlete** through the existing donate popup (UX-02); hype, save, report
  and "Filmed by" credit work the same as clips.
- Photos and videos live together in the Highlights feed and profile grids; a story shows a
  **photo-count indicator** (`1 / 5` chip plus dots in the feed, `📷 5` badge on grid posters).

## Decisions for v1 (reversible later)

1. **Photo stories are public only.** The Vault toggle is hidden for photos and a table constraint
   (`reels_photo_story_public_check`) rejects Vault/exclusive on a story. Paid photo content can
   come with the private Vault bucket (WORK_QUEUE W0-06).
2. **Writes go through one RPC** for the photo list, so count, order and ownership are validated in
   the database; the reel row itself is inserted exactly like a video (same policy, triggers, rights
   attestation, tag status).
3. **Location and camera metadata are removed before upload.** Photos of minors must never carry
   GPS. JPEG metadata segments are stripped in JavaScript after re-encoding; see Privacy.
4. **A view** is 3 seconds on screen (`VIEW_PLAY_MS`), the same threshold as playback for clips.
5. **Graceful before the SQL exists:** the feed treats missing columns as video; the upload sheet
   hides the Photos option when the RPC is missing (same pattern as Rally / account tags).

## Data model (migration `supabase/migrations/20261007230000_photo_stories.sql`)

```sql
alter table public.reels add column if not exists media_type text not null default 'video';
-- constraint reels_media_type_check: media_type in ('video', 'photo_story')
alter table public.reels add column if not exists photo_count smallint not null default 0;
-- photo stories store video_url = '' (column is not null default '').

create table if not exists public.reel_photos (
  id uuid primary key default gen_random_uuid(),
  reel_id uuid not null references public.reels (id) on delete cascade,
  position smallint not null check (position between 0 and 9),
  image_path text not null,  -- Storage path in bucket reels, never a URL (QA review 2026-10-07)
  description text check (description is null or char_length(description) <= 200),
  width integer, height integer,
  created_at timestamptz not null default timezone('utc', now()),
  unique (reel_id, position)
);
```

- **RLS on `reel_photos`:** enabled. Base-table `select` only for the reel's uploader and admins
  (mirrors "Read own or admin reels"). **No direct insert/update/delete grants** — writes only via
  the RPC below.
- **`set_reel_photos(p_reel_id uuid, p_photos jsonb) returns integer`** — `security definer`,
  `search_path = public`. Caller must be the reel's `uploaded_by` profile; reel must have
  `media_type = 'photo_story'` and not be removed; 1–10 items; each item
  `{ "image_path", "description"?, "width"?, "height"? }`; `image_path` must match
  `^<auth.uid()>/stories/<p_reel_id>/<position>-<timestamp>.jpg$` (anchored; no host, so a story can
  never point viewers at an outside server — the original "URL path contains" rule allowed that and
  was replaced after QA review); descriptions trimmed, empty
  → null, ≤ 200. Replaces the rows in array order (`position` 0..n-1) and sets `reels.photo_count`.
  Returns the count. Granted to `authenticated` only. **Publish-once:** succeeds only while
  `photo_count = 0`, so a published story cannot be swapped after tag confirmation, hype or donations
  (a failed attempt can be retried on the same reel id).
- **`reel_photos_feed` view** (granted to `anon, authenticated`): `id, reel_id, position,
  description, width, height, image_path`, joined to `reels`, excluding removed reels; `image_path`
  gated with the same expression `reels_feed` uses for `video_url` (vault/flash/admin/owner/
  subscriber), so a future Vault story is already safe.
- **`reels_feed`:** `create or replace` appending `media_type`, `photo_count`, and `cover_path` (the
  position-0 photo's URL, same gate). Existing columns unchanged and in order.
- Copy the migration onto `apps/mobile/src/backend/db/schema.sql`, add rows to
  `supabase/migrations/README.md` and `docs/engineering/SCHEMA.md` (`pnpm docs:check`). Header with
  purpose, this doc, and rollback (drop view/RPC/table, recreate the previous `reels_feed`, drop the
  two columns).

## TypeScript contract

```ts
// types/database.ts (BACKEND)
Reel += { media_type?: 'video' | 'photo_story' | null; photo_count?: number | null; cover_path?: string | null };
export type ReelPhotoRow = { id: string; reel_id: string; position: number; image_path: string;
  description: string | null; width: number | null; height: number | null };

// data/highlights.ts (HIGHLIGHTS)
export type HighlightMediaType = 'video' | 'photo_story';
export const PHOTO_STORY_MAX_PHOTOS = 10;
export const PHOTO_DESCRIPTION_MAX = 200;
export type StoryPhoto = { id: string; position: number; imageUrl: string;
  description: string | null; width?: number | null; height?: number | null };
HighlightClip += { mediaType?: HighlightMediaType; photoCount?: number; coverUrl?: string | null };
export function isPhotoStory(clip: Pick<HighlightClip, 'mediaType'>): boolean;

// lib/photoStories.ts (PHOTO_STORIES)
export type PhotoStoryDraftPhoto = { uri: string; width?: number; height?: number; description?: string };
export async function fetchStoryPhotos(reelIds: string[]): Promise<Record<string, StoryPhoto[]>>; // {} if SQL missing
export async function createPhotoStory(input: { photos: PhotoStoryDraftPhoto[]; title: string;
  playerId: string; gameId?: string | null; category: ReelCategory; rightsVersion: string;
  onProgress?: (done: number, total: number) => void }): Promise<Reel>;
export async function setStoryPhotos(reelId: string, photos: { imageUrl: string;
  description: string | null; width?: number | null; height?: number | null }[]): Promise<number>;
export async function photoStoriesAvailable(): Promise<boolean>; // false when RPC/columns missing
export function movePhoto<T>(list: T[], from: number, to: number): T[]; // pure reorder helper

// services/MediaUploadService.ts (UPLOAD)
export function stripJpegMetadata(bytes: Uint8Array): Uint8Array; // drops APP1..APP15 except APP14 (Adobe colour); keeps APP0, image data
export async function uploadStoryPhoto(uri: string, storyKey: string, position: number):
  Promise<{ imageUrl: string; width?: number; height?: number }>; // Storage reels/{uid}/stories/{storyKey}/{position}-{ts}.jpg

// hooks/useStoryPhotos.ts (PLAYBACK)
export function useStoryPhotos(clip: HighlightClip | null, enabled: boolean): { photos: StoryPhoto[]; loading: boolean; error: boolean };
```

**Client URLs:** `storyPhotoPublicUrl(path)` in `lib/photoStories.ts` turns a path into the Storage public URL
(`StoryPhoto.imageUrl`, `HighlightClip.coverUrl`).

**Unpublished stories** (`photo_count = 0`) never reach the feed, grids, pending-tag prompts, filmer
rewards or Spotlight; Spotlight features videos only in v1. Storage writes to `reels` are limited to the
caller's own folder by the separate migration `20261007231000_reels_storage_owner_folder.sql`.

## Screens

- **Upload (UPLOAD / PHOTO_STORIES):** the Video step becomes **Media** with a `Video | Photos`
  switch (Photos hidden when unavailable). Photos: pick up to 10 (`allowsMultipleSelection`,
  `selectionLimit`, `exif: false`, `quality: 0.85`), thumbnail strip with **Move earlier / Move
  later** buttons (44-point targets, labelled for screen readers) and Remove; per-photo optional
  description on Details. Required: ≥ 1 photo, caption, athlete tag, rights confirmation with photo
  wording ("I took these photos or have permission from the people in them"); Vault hidden.
  Progress `Uploading photo 2 of 5`. Partial failure: nothing published, retry keeps the draft.
  Draft survives Back (UX-01 rule).
- **Feed (HIGHLIGHTS / PLAYBACK):** `components/Reels/PhotoStoryMedia.tsx` replaces the video area
  when `isPhotoStory(clip)`. Horizontal paging inside the vertical feed; counter chip `2 / 5` and
  dots; the current photo's description above the caption; the rest of `ReelCard` (rail, donate,
  report, credit) unchanged. Each photo: `accessibilityLabel` = description or "Photo 2 of 5";
  adjustable actions to move between photos. Loads photos when the card is current (cover shows meanwhile);
  the Highlights pager and profile viewer prefetch the photo story immediately above and below into the session cache.
- **Grids (PROFILE):** `TaggedReelGrid` poster uses `coverUrl` and shows `📷 5`.

## Privacy and safety

- Metadata: picker `exif: false` and re-encode, then `stripJpegMetadata` on the bytes before upload;
  unit tests prove GPS/EXIF/XMP segments are removed and image data is intact. Orientation after
  stripping must be checked on real iOS and Android devices (DEVICE_QA gate).
- Photos often include other people's children. Rights confirmation covers "permission from the
  people in them"; reports use the existing reasons; the minor-safety rules in LEGAL_BRIEFING apply.
- Bucket `reels` is public (STATE §5): anyone with a URL can view. Acceptable for public stories in
  Wave 0; not acceptable for Vault photos, which v1 does not offer.
- DATA_PRIVACY_MAP gains photos, per-photo descriptions and the metadata rule.

## Ownership for the build (2026-10-07)

| Slice | Primary | Review | Files |
| --- | --- | --- | --- |
| Schema, RLS, RPC, views, types | `DATABASE_MIGRATIONS` + `BACKEND` | `RLS_SECURITY`, `STORAGE` | migration, `schema.sql`, `types/database.ts`, SCHEMA.md, migrations README |
| Upload flow and storage | `PHOTO_STORIES` + `UPLOAD` | `CONTENT_RIGHTS`, `MINOR_SAFETY`, `ACCESSIBILITY` | `lib/photoStories.ts`, `MediaUploadService.ts`, `UploadVideoModal.tsx`, `UploadVideoComposer.tsx`, `data/contentRights.ts` |
| Feed and grids, Game Day label | `HIGHLIGHTS` + `PLAYBACK` | `DESIGN`, `ACCESSIBILITY` | `data/highlights.ts`, `lib/reels.ts`, `PhotoStoryMedia.tsx`, `useStoryPhotos.ts`, `ReelCard.tsx`, `TaggedReelGrid.tsx` |
| Tagline, legal, privacy, docs | `VOICE` + `MARKETING` | `LEGAL`, `PRIVACY_ENGINEERING`, `DOCUMENTATION` | `data/malo.ts`, `WelcomeOverlay`, donate sheet header, profile donate area, VOICE/STORY/PUBLIC/LEGAL/DATA_PRIVACY_MAP/GLOSSARY/TESTER_SCRIPT |
| Roster and hierarchy | `PRODUCT` + `DOCUMENTATION` | `ENGINEERING` | `.claude/agents/*`, registry, TEAMS, TEAM_HIERARCHY, WORK_QUEUE |
| Independent verification | `QA` + `VISUAL_QA` | — | tests, Playwright/browser evidence, AUDIT_REPORT |

## Not in v1

Video + photo mixed stories, photo filters/editing, Vault photo stories, comments, captions on
the image itself, tagging athletes per photo.

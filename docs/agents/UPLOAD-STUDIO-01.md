<!-- Upload studio, @ tagging and profile-grid caption editing: scope, evidence and open checks. -->
# UPLOAD-STUDIO-01 — easier, livelier Highlight upload and owner editing

**Date:** 2026-11-25. **Branch:** `claude/upload-studio` from `main` `4d026d4`. **Executor:** Claude Code (Fable 5.1 session), local checkout only.

## Owner request

Make editing posts and descriptions easy for signed-in owners. Make the upload menu from the upload button clear, fun and good for videos. Simplify tagging, for example with `@`. Keep the existing image and video size limits.

## Baseline

- Caption editing (POST-EDIT-01) existed only in the playback More menu. The profile grid long-press offered Vault controls only, and photo stories showed a toast.
- The Media step showed a small hero with "Video up to 45s." The 8 MB cap was only enforced at Storage time, after details were filled in. On web and Expo Go there is no compressor, so an oversized original failed at Publish.
- Account mentions lived in a separate search box under More options. The gift recipient was chosen on its own search page.
- Baseline Reels and Profile tests: 38 suites, 330 tests passed.

## What changed

- **Start screen.** Big Record now and Camera roll tiles. A limit row reads the enforced constants: up to 45 seconds, under 8 MB, vertical looks best. Photo stories show up to 10 photos, ordering and public-only.
- **Length meter.** The picked clip shows "18s / 45s" on a small meter.
- **Pick-time size check.** When a picked file is already over 8 MB and nothing on the device will compress it, it is refused at pick time with the existing message. Clips the device compresses, and clips of unknown size, keep the existing Storage-time guard.
- **@ tagging in the caption.** Typing `@` shows roster athletes first, then accounts from the existing `search_taggable_accounts` search. Choosing an athlete sets who is in the clip, the same explicit choice the athlete row makes. Choosing an account adds one of at most three mentions as a removable chip. The picked word leaves the caption, so no name appears publicly before that person confirms. An unpicked `@` word stays ordinary text.
- **More options** now holds sport, game and Exclusive only. Review lists mentions by name.
- **Chooser.** Highlight is the featured card with the video limits on it. Labels and actions are unchanged.
- **Profile grid.** Long-pressing your own post offers Edit description, photo stories included. It uses the POST-EDIT-01 ownership rule and `saveReelDescription`. Tagged athletes who did not upload the post never see it.

## Decisions and assumptions

- Gift recipient: an `@` athlete pick sets who is in the clip because the uploader chose it from a list. A typed name never changes the recipient. The owner did not answer the pre-fill question, so this assumption stays open for owner review.
- Beyond moment keeps its separate reviewed composer. Merging the two composers was not attempted.
- Trimming and cover-frame choice were not added. Android has no built-in trim, and new packages cannot be installed while the npm registry is blocked.
- Jev was not reached: `jev/.env` is missing in this checkout. No score was inferred.

## Exemption

Presentation-only, recorded in `docs/agents/feature-admin.json`. No new table, column, RPC, Storage path, permission, telemetry or operator duty. Mentions use the existing `search_taggable_accounts` and `tag_reel_accounts` path and cap. Caption edits use the existing `edit_reel_caption` path.

## Local verification

| Check | Result |
| --- | --- |
| Reels and Profile suites after the change | 40 suites, 343 tests passed |
| New `CaptionMentionInput` suite | 7 tests passed |
| New `UploadLimitChips` suite | 3 tests passed |
| `AthleteReelManager` edit cases | 3 new tests passed |
| Mobile typecheck | Passed |

| Full `pnpm check` under Node 24 | Every gate passed through `exit:map:check` and `security:infra:check`: 336 mobile suites, 3,182 tests; portal 217 tests |
| `exit:sync ensure` (last step) | Failed: the private source-cache state belongs to the main `ala` checkout, not this worktree. Environment limit, no code finding |

## Not verified

- No browser or device run. Upload needs a signed-in account, and this session had no test account to sign in with. Look, tap feel, keyboard behaviour with the suggestion list and the native picker paths need a phone check.
- The hosted caption-edit migration from POST-EDIT-01 is still owner-applied. Until it is applied, Edit description reports that editing is not available yet.
- Real `search_taggable_accounts` results were not exercised against a hosted project.

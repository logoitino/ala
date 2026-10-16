# CHAL-01 — Workout challenges

**Owner request (2026-10-15):** fans respond to athletes' workout posts in the same spirit ("challenge accepted", "I love
this workout"), post their own try, and run friendly challenges with each other. It starts on public posts; the Vault
version comes later. The owner approved the recommended order and said "go":
1. public workout challenges (this record);
2. Vault lock-down (private storage, short-lived links);
3. a season pass (no auto-renew) and subscriber-only posts;
4. digital perks;
5. adult public-event posts after counsel.

Announcements guardrail: athletes under 18 never post in-person times or places, including in the Vault.

**Primary owner:** HIGHLIGHTS (Engineering) with UPLOAD, PROFILE and ADMIN. **Reviews:** MINOR_SAFETY,
PRIVACY_ENGINEERING, RLS_SECURITY, CONTENT_RIGHTS, MODERATION, VOICE, SUPPORT, DATA_GOVERNANCE and the infrastructure
seat. **Original source:** Claude session in the main checkout. **Current authorized completion:** outside-session Codex scoped producers and independent cross-review under [BEYOND-01](BEYOND-01.md). Not committed. Respects PLAY-01's claims on
ReelCard / `lib/reels.ts`.

[Design](../engineering/design/WORKOUT_CHALLENGES_DESIGN.md) · [Feature contract](feature-admin.json)

| Stage | Status |
| --- | --- |
| Enrollment | Planned 2026-10-16T00:33:51Z, before new source |
| Design review | Ten-seat panel: CHANGES NEEDED → all adopted (design §6). Owner decisions: build **1a** (presets, nudges, badge, admin) now; try videos are **CHAL-01b** after the Vault lock-down; when tries open, 13–17 may post them, friends-only and admin pre-checked |
| Backend / admin | Final real local PGlite46/46; all16actor-bound APIs; producer48coveringtests and independent Data/source acceptance |
| Security review | Independent scoped SQL/privacy/admin/participant source acceptance PASS; human/hosted release review remains |
| Admin-ready | Actual local checkpoint/gate passed October16UTC; [evidence](../engineering/evidence/CHAL-01-admin.md). Participant authorized next; no hosted/legal/release acceptance |
| Participant app | Local source accepted and full scan passed; [app evidence](../engineering/evidence/CHAL-01-app.md). Selected app-ready gate result below |

Final selected `pnpm feature-admin:check --feature CHAL-01 --require app-ready` EXIT0. Local source ready with defaultoff switch/unapplied migration; human/hosted/device/launch gates remain. Original admin date and evidence unchanged. Final Documentation/VP closeout in BEYOND-01.

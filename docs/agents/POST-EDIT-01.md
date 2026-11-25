<!-- Caption edit contracts are separate from device and hosted acceptance. -->
# POST-EDIT-01 — edit your post descriptions

Owner approved caption-only editing for Highlights and Beyond. HIGHLIGHTS owns the experience with Backend, Data, Safety and independent QA. Highlight ownership is the canonical uploader profile ID, not the athlete tag or an Auth UUID. Beyond uses its current actor, owner, audience, and moderation contracts. No media, tags, rights attestations, age/visibility rules or payouts change. Removed, held and flagged content must not be restored or edited through this path.

A title-specific database trigger blocks direct author changes while preserving existing operator and upload behavior. Two narrow server functions validate content, author and expected current value/revision. Beyond returns a changed submission to its existing pending review queue before other viewers can see the edit; stale moderator decisions must fail. The existing Expo moderation and Beyond desks remain authoritative. Mounted editors retain the draft on failure and reconcile only a validated result for the current account and post. No silent retry after an uncertain write. The local PostgreSQL replay and selected admin-ready check precede participant implementation. Hosted SQL and device verification are separate.

## Source and admin checkpoint

Actual PostgreSQL 18 (CI-pinned PGlite 0.5.9 downloaded and checksum-verified in the owner's Terminal) passed 13 focused case groups, including migration reapply and the existing admin title editor, and 123 canonical schema checks. The existing Highlight column grant also permitted direct uploader title writes; a narrowly scoped invoker trigger now routes those writes through the owner RPC while preserving the admin and upload paths. Beyond reuses existing revision-checked approval and the same pending queue; tests confirm old review decisions cannot approve the changed text, and media, audience and historical admin events survive. Stale requests return SQLSTATE 40001; denied or invalid results never publish a client confirmation.

Local admin/route tests passed (20), generated database types rebuilt, DataGov mapped all three functions, and the retained detection catalog identifies the absence of hosted monitoring. Expo's control map and the Next read-only coverage surface reference the existing content desks. No hosted SQL was applied.

## App checkpoint

In Highlight playback, the uploader opens More → Edit description. In Beyond, eligible authors edit from My posts and see that the changes go back for review. Mounted tests cover an uploader versus a tagged athlete, original raw text, failure retaining the draft, validated saves, unavailable/held/shared Beyond items and invalidation when the account, tab, category or row changes. Client receipt tests cover stale or mismatched results, no automatic retry, unchanged Beyond audience/media and no updates to different or newer local reel rows. The Android platform bundle exported locally; physical Android and staged two-account verification are still pending. Before shipping the caption editor, apply the migration to the intended staging database and repeat owner, viewer and reviewer checks there.


## Highlight refresh follow-up

A delayed Home refresh reproduced the old caption reappearing after a confirmed save. Home and both profile clip readers now apply receipts that arrived during a read, only to a returned row with the matching post, uploader and previous title. Removed or flagged rows are excluded from receipt updates. A newer server caption, media, reactions and other returned fields retain their values. A new read replaces an older Home read, and receipt tracking is released when the read settles or its screen withdraws it. No schema, admin workflow, storage or telemetry change. This is a local repair; staging still requires the owner migration and device test.

## Read-only staging preflight

In the SQL Editor for **ala-sports-staging**, run this catalog query. It returns two rows and does not read or modify app records. A new target with the prerequisites in place shows **26/26** prerequisites and **0/4** new objects. After the owner applies the [specific caption migration](../../supabase/migrations/20261124010000_post_caption_edits.sql), expect **26/26** and **4/4**. If anything is partial or missing, reconcile the catalog and the staging migration history before applying anything. Object presence does not prove the permissions or the full save flow; complete the [tester script](../engineering/TESTER_SCRIPT.md#android-and-caption-acceptance--ux-20-ux-21-post-edit-01) separately.

```sql
-- Run in the ala-sports-staging SQL Editor only.
-- Returns names and booleans from PostgreSQL catalogs; does not change or inspect app rows.
with expected(phase, kind, relation, item) as (
  values
    ('prerequisite', 'column', 'public.reels', 'id'),
    ('prerequisite', 'column', 'public.reels', 'title'),
    ('prerequisite', 'column', 'public.reels', 'uploaded_by'),
    ('prerequisite', 'column', 'public.reels', 'is_removed'),
    ('prerequisite', 'column', 'public.reels', 'is_flagged'),
    ('prerequisite', 'column', 'public.profiles', 'age_blocked_at'),
    ('prerequisite', 'column', 'public.profiles', 'id'),
    ('prerequisite', 'column', 'public.profiles', 'user_id'),
    ('prerequisite', 'column', 'public.app_runtime_config', 'id'),
    ('prerequisite', 'column', 'public.beyond_posts', 'id'),
    ('prerequisite', 'column', 'public.beyond_posts', 'owner_id'),
    ('prerequisite', 'column', 'public.beyond_posts', 'owner_user_id'),
    ('prerequisite', 'column', 'public.beyond_posts', 'caption'),
    ('prerequisite', 'column', 'public.beyond_posts', 'status'),
    ('prerequisite', 'column', 'public.beyond_posts', 'revision'),
    ('prerequisite', 'column', 'public.beyond_posts', 'reviewed_at'),
    ('prerequisite', 'column', 'public.beyond_posts', 'reviewer_id'),
    ('prerequisite', 'column', 'public.beyond_posts', 'review_reason'),
    ('prerequisite', 'function', null, 'public.profile_age_band(uuid)'),
    ('prerequisite', 'function', null, 'public.my_profile_id()'),
    ('prerequisite', 'function', null, 'public.current_user_role()'),
    ('prerequisite', 'function', null, 'public.beyond_actor(uuid,boolean)'),
    ('prerequisite', 'function', null, 'public.beyond_enabled()'),
    ('prerequisite', 'function', null, 'public.beyond_owner_open(uuid)'),
    ('prerequisite', 'function', null, 'public.beyond_post_json(uuid,boolean)'),
    ('prerequisite', 'function', null, 'public.admin_beyond_review(uuid,uuid,integer,text,text)'),
    ('new', 'function', null, 'public.edit_reel_caption(uuid,uuid,text,text)'),
    ('new', 'function', null, 'public.beyond_edit_caption(uuid,uuid,integer,text)'),
    ('new', 'function', null, 'public.guard_reel_caption_edit()'),
    ('new', 'trigger', 'public.reels', 'reels_guard_caption_edit')
), results as (
select phase, coalesce(relation || '.', '') || item as requirement,
  case kind
    when 'column' then exists (select from pg_catalog.pg_attribute
      where attrelid = pg_catalog.to_regclass(relation) and attname = item
        and attnum > 0 and not attisdropped)
    when 'function' then pg_catalog.to_regprocedure(item) is not null
    when 'trigger' then exists (select from pg_catalog.pg_trigger
      where tgrelid = pg_catalog.to_regclass(relation) and tgname = item
        and tgenabled = 'O' and not tgisinternal)
  end as present
from expected
)
select phase, count(*) filter (where present) as present, count(*) as expected,
  coalesce(array_agg(requirement order by requirement) filter (where not present), array[]::text[]) as missing
from results
group by phase
order by case phase when 'prerequisite' then 0 else 1 end;
```

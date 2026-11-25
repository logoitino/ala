#!/usr/bin/env node
/** POST-EDIT-01 verifies the real SQL against synthetic creators, viewers, and review states. No hosted access. Earlier canonical blocks remain intact when later migrations append. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { SUPABASE_STUBS } from './supabase-stubs.mjs';

const [dist] = process.argv.slice(2);
if (!dist) throw new Error('Pass an installed PGlite dist directory.');
const { PGlite } = await import(pathToFileURL(path.join(dist, 'index.js')).href);
const { pgcrypto } = await import(pathToFileURL(path.join(dist, 'contrib/pgcrypto.js')).href);
const db = new PGlite({ extensions: { pgcrypto } });
const root = new URL('../../', import.meta.url);
const migration = fs.readFileSync(new URL('supabase/migrations/20261124010000_post_caption_edits.sql', root), 'utf8');
const canonical = fs.readFileSync(new URL('apps/mobile/src/backend/db/schema.sql', root), 'utf8');
const uid = (n) => '00000000-0000-4000-8000-' + String(n).padStart(12, '0');
const ids = { author: uid(1), athlete: uid(2), admin: uid(3), closed: uid(4), unknown: uid(5) };
const query = async (sql, args) => (await db.query(sql, args)).rows;
const scalar = async (sql, args) => (await query(sql, args))[0]?.value;
const profiles = {};
let passed = 0;

async function as(actor, action) {
  const role = actor === 'guest' ? 'anon' : actor === 'service' ? 'service_role' : 'authenticated';
  await scalar("select set_config('request.jwt.claims', $1, false) as value", [
    JSON.stringify({ role, ...(ids[actor] ? { sub: ids[actor] } : {}) }),
  ]);
  await db.exec('set role ' + role);
  try { return await action(); }
  finally { await db.exec('reset role; reset request.jwt.claims;'); }
}
const reelEdit = (actor, id, expected, next, expectedActor = profiles[actor] ?? null) =>
  as(actor, () => scalar('select public.edit_reel_caption($1,$2,$3,$4) as value', [expectedActor, id, expected, next]));
const beyondEdit = (actor, id, revision, next, expectedActor = profiles[actor] ?? null) =>
  as(actor, () => scalar('select public.beyond_edit_caption($1,$2,$3,$4) as value', [expectedActor, id, revision, next]));
const beyondSwitch = (enabled) =>
  as('admin', () => scalar('select public.admin_beyond_set_enabled($1,$2,$3) as value', [
    profiles.admin, enabled, 'Synthetic moderation configuration',
  ]));
const beyondReview = (id, revision, action = 'approve') =>
  as('admin', () => scalar('select public.admin_beyond_review($1,$2,$3,$4,$5) as value', [
    profiles.admin, id, revision, action, 'Synthetic review of this revision',
  ]));

async function test(label, fn) {
  await fn();
  passed += 1;
  console.log('PASS ' + label);
}

try {
  await db.exec(SUPABASE_STUBS);
  await db.exec(canonical);
  await test('canonical source installs all three functions and the title guard', async () => {
    const result = await query(
      "select proname from pg_proc where pronamespace='public'::regnamespace and proname in ('edit_reel_caption','beyond_edit_caption','guard_reel_caption_edit') order by proname",
    );
    assert.deepEqual(result.map(x => x.proname), ['beyond_edit_caption', 'edit_reel_caption', 'guard_reel_caption_edit']);
    assert.equal(await scalar(
      "select count(*)::int as value from pg_trigger where tgname='reels_guard_caption_edit' and tgrelid='public.reels'::regclass and tgenabled='O'",
    ), 1);
  });
  await test('migration reapplies on the canonical schema without duplicate triggers', async () => {
    await db.exec(migration);
    assert.equal(await scalar(
      "select count(*)::int as value from pg_trigger where tgname='reels_guard_caption_edit' and tgrelid='public.reels'::regclass",
    ), 1);
    assert.ok(canonical.includes(migration), 'canonical schema must include the unchanged incremental block');
  });

  for (const [name, id] of Object.entries(ids)) {
    const metadata = name === 'unknown' ? {} : { birth_year: '1990', birth_month: '1' };
    await query('insert into auth.users (id, raw_user_meta_data) values ($1,$2)', [id, JSON.stringify(metadata)]);
    profiles[name] = await scalar('select id as value from public.profiles where user_id=$1', [id]);
    assert.ok(profiles[name]);
    assert.notEqual(profiles[name], id);
  }
  await query("update public.profiles set role='admin',is_admin=true where id=$1", [profiles.admin]);
  await query('update public.profiles set age_blocked_at=now() where id=$1', [profiles.closed]);
  const player = uid(21);
  await query("insert into public.players(id,name) values($1,'Test tagged athlete')", [player]);
  await query(
    "update public.profiles set player_id=$1, role='athlete', verification_status='verified' where id=$2",
    [player, profiles.athlete],
  );
  await query(
    "update public.profiles set account_private=false, profile_audience=jsonb_build_object('photo','everyone') where id=$1",
    [profiles.author],
  );
  await query(
    "insert into public.friendships(requester_id,addressee_id,status,responded_at) values ($1,$2,'accepted',now())",
    [profiles.author, profiles.athlete],
  );

  const reels = {
    live: uid(31), flagged: uid(32), removed: uid(33), legacy: uid(34),
    blank: uid(35), padded: uid(36), closed: uid(37), unknown: uid(38),
  };
  await db.exec("select set_config('app.tapuai_tag_write','on',false)");
  try {
    for (const [kind, id] of Object.entries(reels)) {
      await query(
        "insert into public.reels(id,title,player_id,uploaded_by,video_url,tag_status,is_flagged,is_removed,category,seki_count) values($1,$2,$3,$4,'https://fixture.invalid/reel.mp4','confirmed',$5,$6,'game_play',7)",
        [id, kind === 'blank' ? '' : kind === 'padded' ? '  Original  ' : 'Original',
          player, kind === 'legacy' ? null : profiles[kind] ?? profiles.author,
          kind === 'flagged', kind === 'removed'],
      );
    }
  } finally {
    await db.exec("select set_config('app.tapuai_tag_write','off',false)");
  }

  const reelView = (id) => scalar('select to_jsonb(r) as value from public.reels r where id=$1', [id]);
  await test('only the authenticated DB role may call either edit RPC', async () => {
    for (const actor of ['guest', 'service']) {
      await assert.rejects(reelEdit(actor, reels.live, 'Original', 'No', profiles.author), { code: '42501' });
      await assert.rejects(beyondEdit(actor, uid(60), 1, 'No', profiles.author), { code: '42501' });
    }
    assert.equal(await scalar(
      "select has_function_privilege('authenticated','public.guard_reel_caption_edit()','execute') as value",
    ), false);
  });
  await test('uploader, actor and tag scopes are distinct from administrator authority', async () => {
    await assert.rejects(reelEdit('author', reels.live, 'Original', 'No', ids.author), { code: '42501' });
    await assert.rejects(reelEdit('author', reels.live, 'Original', 'No', null), { code: '42501' });
    await assert.rejects(reelEdit('athlete', reels.live, 'Original', 'No', profiles.author), { code: '42501' });
    await assert.rejects(reelEdit('athlete', reels.live, 'Original', 'No'), { code: '42501' });
    await assert.rejects(reelEdit('admin', reels.live, 'Original', 'No'), { code: '42501' });
    assert.equal((await reelView(reels.live)).title, 'Original');
  });
  await test('unowned, missing, flagged, removed, and age-blocked Highlight rows are not editable', async () => {
    for (const id of [reels.legacy, reels.flagged, reels.removed, uid(999)]) {
      await assert.rejects(reelEdit('author', id, 'Original', 'No'), { code: '42501' });
    }
    await assert.rejects(reelEdit('closed', reels.closed, 'Original', 'No'), { code: '42501' });
    await assert.rejects(reelEdit('unknown', reels.unknown, 'Original', 'No'), { code: '42501' });
  });
  await test('invalid new Highlight text and a missing expected title do not write', async () => {
    for (const text of [null, '', '\u00a0\t\u2028', '😀'.repeat(121)]) {
      await assert.rejects(reelEdit('author', reels.live, 'Original', text), { code: '22023' });
    }
    await assert.rejects(reelEdit('author', reels.live, null, 'A new description'), { code: '40001' });
    assert.equal((await reelView(reels.live)).title, 'Original');
  });
  await test('Highlight compare uses the exact stored title, including an existing empty title', async () => {
    await assert.rejects(reelEdit('author', reels.padded, 'Original', 'Updated'), { code: '40001' });
    assert.deepEqual(await reelEdit('author', reels.padded, '  Original  ', 'Updated'), {
      id: reels.padded, caption: 'Updated',
    });
    assert.deepEqual(await reelEdit('author', reels.blank, '', 'New description'), {
      id: reels.blank, caption: 'New description',
    });
  });
  await test('Highlight owner edit trims text, returns only a receipt, and changes only title', async () => {
    const prior = await reelView(reels.live);
    const caption = '😀'.repeat(120);
    const receipt = await reelEdit('author', reels.live, 'Original', '\u00a0' + caption + '\r\n');
    assert.deepEqual(receipt, { id: reels.live, caption });
    assert.deepEqual(await reelView(reels.live), { ...prior, title: caption });
    assert.deepEqual(await reelEdit('author', reels.live, caption, caption), receipt);
    await assert.rejects(reelEdit('author', reels.live, 'Original', 'Different draft'), { code: '40001' });
    assert.deepEqual(await reelView(reels.live), { ...prior, title: caption });
  });
  await test('direct participant caption update is denied but existing admin title/category update still works', async () => {
    const update = (actor, title) => as(actor, () =>
      scalar("update public.reels set title=$1,category='serve_like_me' where id=$2 returning title as value",
        [title, reels.live]));
    await assert.rejects(update('author', 'Direct caller'), { code: '42501' });
    assert.equal((await reelView(reels.live)).category, 'game_play');
    assert.equal(await update('admin', 'Reviewed caption'), 'Reviewed caption');
    assert.equal((await reelView(reels.live)).category, 'serve_like_me');
    const result = await as('author', () => scalar(
      "update public.reels set category='game_play' where id=$1 returning title as value", [reels.live],
    ));
    assert.equal(result, 'Reviewed caption');
    assert.equal((await reelView(reels.live)).category, 'game_play');
    assert.equal(await scalar("select has_column_privilege('authenticated','public.reels','title','insert') as value"), true);
  });

  const media = uid(61);
  const insertBeyond = (id, actor, status) => query(
    "insert into public.beyond_posts(id, owner_id, owner_user_id, request_id, category, caption, audience, status, rights_version, safety_version, submitted_at) values($1,$2,$3,$1,'story','Original Beyond caption','friends',$4,'beyond-rights-1','beyond-safety-1',now())",
    [id, profiles[actor], ids[actor], status],
  );
  assert.equal((await beyondSwitch(true)).enabled, true);
  const draft = await as('author', () => scalar(
    "select public.beyond_reserve($1,$2,'story','Original Beyond caption','friends',$3,'beyond-rights-1','beyond-safety-1') as value",
    [profiles.author, uid(60), JSON.stringify([{ id: media, kind: 'photo', bytes: 24, width: 1, height: 1 }])],
  ));
  const post = draft.id;
  assert.equal(draft.status, 'draft');
  await as('author', () => query(
    "insert into storage.objects(bucket_id,name,owner,metadata) values('beyond_game',$1,$2,$3)",
    [draft.media[0].path, ids.author, JSON.stringify({ mimetype: 'image/jpeg', size: 24 })],
  ));
  const submission = await as('author', () => scalar('select public.beyond_finalize($1,$2) as value', [profiles.author, post]));
  let approved;
  await test('existing switch blocks editing and its old approval path still works after enabling', async () => {
    assert.equal(submission.status, 'pending');
    assert.equal((await beyondSwitch(false)).enabled, false);
    await assert.rejects(beyondEdit('author', post, submission.revision, 'No'), { code: '42501' });
    assert.equal((await beyondSwitch(true)).enabled, true);
    approved = await beyondReview(post, submission.revision);
    assert.equal(approved.status, 'approved');
    assert.equal(approved.revision, submission.revision + 1);
  });
  const findFeed = () => as('athlete', async () => (await scalar(
    "select public.beyond_posts($1,'story',30,null) as value", [profiles.athlete],
  )).posts.find(x => x.id === post));
  await test('Beyond wrong actors, stale revisions and invalid captions do not supersede approved content', async () => {
    assert.equal((await findFeed()).caption, 'Original Beyond caption');
    await assert.rejects(beyondEdit('athlete', post, approved.revision, 'No', profiles.author), /account changed/i);
    await assert.rejects(beyondEdit('athlete', post, approved.revision, 'No'), { code: '42501' });
    await assert.rejects(beyondEdit('admin', post, approved.revision, 'No'), { code: '42501' });
    for (const rev of [submission.revision, null]) await assert.rejects(beyondEdit('author', post, rev, 'No'), { code: '40001' });
    for (const text of [null, '\u00a0\t', 'a'.repeat(241)]) {
      await assert.rejects(beyondEdit('author', post, approved.revision, text), { code: '22023' });
    }
    const unchanged = await beyondEdit('author', post, approved.revision, '  Original Beyond caption \t');
    assert.equal(unchanged.status, 'approved');
    assert.equal(unchanged.revision, approved.revision);
    assert.equal(unchanged.review_reason, approved.review_reason);
    assert.equal((await findFeed()).caption, unchanged.caption);
  });
  await test('changed Beyond caption returns to review with media, audience, and prior audit intact', async () => {
    const edited = await beyondEdit('author', post, approved.revision, '  New Beyond caption  ');
    assert.equal(edited.id, post);
    assert.equal(edited.caption, 'New Beyond caption');
    assert.equal(edited.status, 'pending');
    assert.equal(edited.revision, approved.revision + 1);
    assert.equal(edited.creator_id, profiles.author);
    assert.deepEqual(edited.media, approved.media);
    assert.equal(edited.audience, approved.audience);
    assert.equal(edited.rights_version, approved.rights_version);
    assert.equal(edited.safety_version, approved.safety_version);
    assert.equal(edited.attested_at, approved.attested_at);
    assert.equal(edited.submitted_at, approved.submitted_at);
    assert.equal(edited.review_reason, null);
    assert.equal(edited.reviewed_at, null);
    assert.equal(await findFeed(), undefined);
    assert.equal(await scalar(
      "select count(*)::int as value from public.beyond_admin_events where post_id=$1 and action='approve'",
      [post],
    ), 1);

    const pending = await as('admin', () => scalar(
      "select public.admin_beyond_posts($1,'pending',30,null) as value", [profiles.admin],
    ));
    assert.ok(pending.posts.some(x => x.id === post && x.revision === edited.revision && x.caption === edited.caption));
    await assert.rejects(beyondReview(post, approved.revision), /submission changed/i);
    await assert.rejects(beyondEdit('author', post, approved.revision, 'Stale draft'), { code: '40001' });
    const reviewed = await beyondReview(post, edited.revision);
    assert.equal(reviewed.revision, edited.revision + 1);
    assert.equal((await findFeed()).caption, 'New Beyond caption');
  });
  await test('pending Beyond text keeps pending state and invalidates stale moderation; held/removed/drafts stay protected', async () => {
    const pending = uid(64);
    await insertBeyond(pending, 'author', 'pending');
    const edited = await beyondEdit('author', pending, 1, 'Revised pending text');
    assert.equal(edited.status, 'pending');
    assert.equal(edited.revision, 2);
    await assert.rejects(beyondReview(pending, 1, 'remove'), /submission changed/i);

    for (const [offset, state] of ['held', 'removed', 'draft'].entries()) {
      const id = uid(70 + offset);
      await insertBeyond(id, 'author', state);
      await assert.rejects(beyondEdit('author', id, 1, 'No'), { code: '42501' });
    }
    const closed = uid(73);
    await insertBeyond(closed, 'closed', 'pending');
    await assert.rejects(beyondEdit('closed', closed, 1, 'No'), /account changed/i);
    await beyondSwitch(false);
    await assert.rejects(beyondEdit('author', post, approved.revision + 2, 'Paused edit'), { code: '42501' });
  });
  console.log('POST-EDIT-01: ' + passed + ' real PostgreSQL cases passed (canonical + migration reapply).');
} catch (error) {
  // Only synthetic fixture data lives here; keep driver internals and SQL bodies out of routine logs.
  console.error('FAIL ' + (error.code ?? '') + ' ' + error.message);
  process.exitCode = 1;
} finally {
  await db.close();
}

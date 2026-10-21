#!/usr/bin/env python3
"""Synthetic PostgreSQL replay of failed-story cleanup, RLS denials and competing commits.

Uses only a private temporary local cluster; no credentials, hosted data or package installs.
Run: python3 apps/mobile/src/backend/db/failedPhotoStoryCleanup.replay.py --pg-bin /tmp/pg17/bin
The old publish RPC is read from its unchanged migration so terminal-state tests cover that API.
Storage is a synthetic metadata table: byte removal and deployed Supabase compatibility need
separate hosted verification. This runner does not modify app/redundancy artifacts.
"""
import argparse
import os
from pathlib import Path
import subprocess
import tempfile
import threading
import time

ROOT = Path(__file__).resolve().parents[5]
OWNER = '10000000-0000-4000-8000-000000000001'
OTHER = '10000000-0000-4000-8000-000000000002'
ADMIN = '10000000-0000-4000-8000-000000000003'
CLOSED = '10000000-0000-4000-8000-000000000004'
PID = '20000000-0000-4000-8000-000000000001'
SID = '30000000-0000-4000-8000-000000000001'


def run():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--pg-bin', default=os.environ.get('PG_BIN', '/tmp/pg17/bin'))
    opts = parser.parse_args()
    pg = Path(opts.pg_bin)
    for name in ('initdb', 'pg_ctl', 'psql'):
        if not (pg / name).is_file():
            raise SystemExit(f'Missing local PostgreSQL tool: {pg / name}; supply --pg-bin')
    passed = 0
    with tempfile.TemporaryDirectory(prefix='tapuai-photo-cleanup-', dir='/tmp') as temporary:
        temp = Path(temporary)
        data = temp / 'data'
        socket = temp / 'socket'
        socket.mkdir()
        subprocess.run([str(pg / 'initdb'), '-D', str(data), '-A', 'trust', '--no-locale',
                        '-c', 'shared_memory_type=mmap', '-c', 'dynamic_shared_memory_type=mmap'],
                       check=True, stdout=subprocess.DEVNULL)
        subprocess.run([str(pg / 'pg_ctl'), '-D', str(data), '-l', str(temp / 'server.log'),
                        '-o', f"-k {socket} -p 57483 -c listen_addresses=''", '-w', 'start'],
                       check=True, stdout=subprocess.DEVNULL)
        base = [str(pg / 'psql'), '-X', '-h', str(socket), '-p', '57483', '-d', 'postgres',
                '-qAt', '-v', 'ON_ERROR_STOP=1', '-v', 'VERBOSITY=verbose']

        def sql(statement, uid=None, role='authenticated', error=None):
            if uid is not None:
                statement = (f"set role {role}; set request.jwt.claim.sub='{uid}'; "
                             f"set request.jwt.claim.role='{role}'; " + statement)
            result = subprocess.run(base, input=statement, text=True, capture_output=True)
            if error:
                assert result.returncode and error in result.stderr, (statement, result.stdout, result.stderr)
            else:
                assert result.returncode == 0, (statement, result.stdout, result.stderr)
            return result.stdout.strip()

        def check(label, statement, expected=None, uid=OWNER, role='authenticated', error=None):
            nonlocal passed
            actual = sql(statement, uid, role, error)
            if expected is not None:
                assert actual == str(expected), (label, actual, expected)
            passed += 1
            print(f'PASS {label}', flush=True)

        def draft(identifier, owner=PID, count=0, media='photo_story', removed=False):
            sql(f"insert into public.reels(id,uploaded_by,media_type,is_removed) values "
                f"('{identifier}','{owner}','{media}',{str(removed).lower()});")
            if count:
                sql(f"update public.reels set photo_count={count} where id='{identifier}';")

        def path(identifier, name='0-1780000000000.jpg', uid=OWNER):
            return f'{uid}/stories/{identifier}/{name}'

        def claim(identifier):
            return f"select public.begin_failed_photo_story_cleanup('{identifier}')->>'status';"

        def finish(identifier):
            return f"select public.finish_failed_photo_story_cleanup('{identifier}')->>'status';"

        def upload(identifier, name='0-1780000000000.jpg', uid=OWNER):
            return f"insert into storage.objects(bucket_id,name) values ('reels','{path(identifier,name,uid)}');"

        def race(label, holding, competing, expected, error=None):
            """Keep transaction one open, prove transaction two waits, then commit one."""
            nonlocal passed
            blocker = subprocess.Popen(base, stdin=subprocess.PIPE, stdout=subprocess.PIPE,
                                       stderr=subprocess.PIPE, text=True, bufsize=1)
            prefix = (f"set role authenticated; set request.jwt.claim.sub='{OWNER}'; "
                      "set request.jwt.claim.role='authenticated'; ")
            blocker.stdin.write('begin; ' + prefix + holding + "\nselect 'LOCK_HELD';\n")
            blocker.stdin.flush()
            while True:
                line = blocker.stdout.readline()
                if line.strip() == 'LOCK_HELD':
                    break
                assert line, blocker.stderr.read()
            result = {}

            def compete():
                try:
                    result['value'] = sql("set application_name='photo_cleanup_race'; " + competing,
                                          OWNER, error=error)
                except BaseException as exc:
                    result['error'] = exc

            thread = threading.Thread(target=compete)
            thread.start()
            deadline = time.monotonic() + 5
            while True:
                waiting = sql("select count(*) from pg_stat_activity where "
                              "application_name='photo_cleanup_race' and wait_event_type='Lock';")
                if waiting == '1':
                    break
                if not thread.is_alive() or time.monotonic() >= deadline:
                    raise AssertionError(f'{label}: competing transaction did not wait: {result}')
                time.sleep(0.03)
            blocker.stdin.write('commit;\n\\q\n')
            blocker.stdin.flush()
            assert blocker.wait(timeout=5) == 0, blocker.stderr.read()
            thread.join(timeout=5)
            assert not thread.is_alive(), label
            if result.get('error'):
                raise result['error']
            if expected is not None:
                assert result['value'] == expected, (label, result)
            passed += 1
            print(f'PASS {label} (observed PostgreSQL row-lock wait)', flush=True)

        try:
            sql("""
create role anon; create role authenticated; create role service_role bypassrls;
create schema auth; create schema storage;
grant usage on schema public,auth,storage to anon,authenticated,service_role;
create function auth.uid() returns uuid language sql stable as $$
 select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
create function auth.role() returns text language sql stable as $$
 select nullif(current_setting('request.jwt.claim.role',true),'') $$;
create table public.profiles(id uuid primary key,user_id uuid unique,role text,age_blocked_at timestamptz);
create function public.caller_not_age_blocked() returns boolean language sql stable security definer
 set search_path='' as $$ select not exists(select 1 from public.profiles
 where user_id=auth.uid() and age_blocked_at is not null) $$;
create table public.reels(id uuid primary key,uploaded_by uuid,media_type text default 'video',
 photo_count smallint not null default 0,is_removed boolean default false,title text default '');
create table public.reel_photos(id uuid default gen_random_uuid(),reel_id uuid references public.reels(id)
 on delete cascade,position smallint,image_path text,description text,width integer,height integer);
create table storage.objects(id uuid default gen_random_uuid() primary key,bucket_id text,name text,
 metadata jsonb default '{}',owner_id text,version text,updated_at timestamptz default now(),
 last_accessed_at timestamptz);
alter table public.reels enable row level security;
alter table storage.objects enable row level security;
grant select,insert on public.reels to authenticated;
grant update(title) on public.reels to authenticated;
grant select,insert,update,delete on storage.objects to authenticated,service_role;
create policy own_reels on public.reels for all to authenticated
 using(uploaded_by=(select id from public.profiles where user_id=auth.uid()))
 with check(uploaded_by=(select id from public.profiles where user_id=auth.uid()));
grant select on public.profiles to authenticated;
create policy object_read on storage.objects for select using(true);
create policy object_insert on storage.objects for insert to authenticated
 with check(bucket_id='reels' and (split_part(name,'/',1)=auth.uid()::text
 or (split_part(name,'/',1)='reels' and split_part(name,'/',2)=auth.uid()::text)));
create policy object_update on storage.objects for update to authenticated
 using(bucket_id='reels' and (split_part(name,'/',1)=auth.uid()::text
 or (split_part(name,'/',1)='reels' and split_part(name,'/',2)=auth.uid()::text)))
 with check(bucket_id='reels' and (split_part(name,'/',1)=auth.uid()::text
 or (split_part(name,'/',1)='reels' and split_part(name,'/',2)=auth.uid()::text)));
create policy "Closed accounts" on storage.objects as restrictive for all to authenticated
 using(public.caller_not_age_blocked()) with check(public.caller_not_age_blocked());
""")
            for n, uid in enumerate((OWNER, OTHER, ADMIN, CLOSED), 1):
                profile = f'20000000-0000-4000-8000-{n:012d}'
                blocked = "now()" if uid == CLOSED else 'null'
                sql(f"insert into public.profiles values('{profile}','{uid}',"
                    f"'{ 'admin' if uid == ADMIN else 'fan'}',{blocked});")
            old = (ROOT / 'supabase/migrations/20261007230000_photo_stories.sql').read_text()
            start = old.index('create or replace function public.set_reel_photos(')
            end = old.index('-- 4. Fan-facing', start)
            sql(old[start:end])
            migration = (ROOT / 'supabase/migrations/20261020190000_failed_photo_story_cleanup.sql').read_text()
            sql(migration)
            sql(migration)
            passed += 1
            print('PASS new migration parses and replays twice alongside unchanged publish RPC', flush=True)
            draft(SID)
            check('ordinary photo upload accepted', upload(SID))
            check('delete unavailable before claim',
                  f"delete from storage.objects where name='{path(SID)}'; select count(*) from storage.objects;", '1')
            check('finish refuses unclaimed draft', finish(SID), error='55000')
            check('begin returns exact owned prefix',
                  f"select public.begin_failed_photo_story_cleanup('{SID}')->>'prefix';", f'{OWNER}/stories/{SID}/')
            check('claim idempotent', claim(SID), 'pending')
            check('finish refuses remaining storage metadata', finish(SID), error='55000')
            check('late upload rejected after claim', upload(SID, '1-1780000000000.jpg'), error='42501')
            check('late metadata-only update rejected',
                  f"update storage.objects set owner_id='changed' where name='{path(SID)}';", error='42501')
            check('claimed object cannot move into video folder',
                  f"update storage.objects set name='reels/{OWNER}/1780000000000.mp4' where name='{path(SID)}';", error='42501')
            payload = f'''[{{"image_path":"{path(SID)}"}}]'''
            check('old publish RPC rolls back claimed draft',
                  f"select public.set_reel_photos('{SID}','{payload}'::jsonb);", error='23514')
            check('failed publish did not leave photo rows',
                  f"select count(*) from public.reel_photos where reel_id='{SID}';", '0', uid=None)
            check('client cannot change server marker',
                  f"update public.reels set photo_cleanup_pending=false where id='{SID}';", error='42501')
            check('even trusted ordinary update cannot reopen',
                  f"update public.reels set photo_cleanup_pending=false where id='{SID}';", error='55000', uid=None)
            check('other owner cannot claim', claim(SID), uid=OTHER, error='42501')
            check('admin does not inherit cleanup authority', claim(SID), uid=ADMIN, error='42501')
            check('other owner cannot finish', finish(SID), uid=OTHER, error='42501')
            check('closed account cannot claim', claim(SID), uid=CLOSED, error='42501')
            check('anon has no cleanup execute privilege', claim(SID), uid=OWNER, role='anon', error='42501')
            check('service role has no cleanup execute privilege', claim(SID), uid=OWNER, role='service_role', error='42501')
            check('forged INSERT marker reset',
                  "insert into public.reels(id,uploaded_by,media_type,photo_cleanup_pending) values "
                  f"('30000000-0000-4000-8000-000000000099','{PID}','photo_story',true); "
                  "select photo_cleanup_pending from public.reels where id='30000000-0000-4000-8000-000000000099';", 'f')
            check('other owner delete does not remove objects',
                  f"delete from storage.objects where name='{path(SID)}'; select count(*) from storage.objects;", '1', uid=OTHER)
            check('closed account delete does not remove objects',
                  f"delete from storage.objects where name='{path(SID)}';", uid=CLOSED)
            check('owner removes claimed metadata through Storage grant',
                  f"delete from storage.objects where name='{path(SID)}'; select count(*) from storage.objects;", '0')
            check('finish removes empty claimed draft', finish(SID), 'discarded')
            check('finish absent draft is idempotent', finish(SID), 'discarded')
            check('begin absent draft is idempotent', claim(SID), 'discarded')
            check('insert cannot resurrect missing story objects', upload(SID), error='42501')
            check('null id rejected', 'select public.begin_failed_photo_story_cleanup(null);', error='22023')

            live = '30000000-0000-4000-8000-000000000010'
            draft(live)
            check('published story preparation uploads object', upload(live))
            check('normal publish with old RPC succeeds',
                  f"select public.set_reel_photos('{live}','[{{\"image_path\":\"{path(live)}\"}}]'::jsonb);", '1')
            check('lost publish reply detected without claiming', claim(live), 'published')
            check('live marker remains false', f"select photo_cleanup_pending from public.reels where id='{live}';", 'f')
            check('live story timestamp-only bookkeeping allowed',
                  f"update storage.objects set updated_at=now(),last_accessed_at=now() where name='{path(live)}';")
            check('service timestamp-only bookkeeping allowed',
                  f"update storage.objects set last_accessed_at=now() where name='{path(live)}';", role='service_role')
            check('live story metadata rewrite refused',
                  f"update storage.objects set metadata='{{\"size\":123}}'::jsonb where name='{path(live)}';", error='42501')
            check('live story version rewrite refused',
                  f"update storage.objects set version='new-content-version' where name='{path(live)}';", error='42501')
            check('service live story version rewrite refused',
                  f"update storage.objects set version='new-content-version' where name='{path(live)}';", role='service_role', error='42501')
            check('live story insert refused', upload(live), error='42501')
            check('live story finish refused', finish(live), error='55000')
            sql(f"update public.reels set is_removed=true where id='{live}';")
            check('removed published story refuses cleanup', claim(live), error='42501')
            video = '30000000-0000-4000-8000-000000000011'
            draft(video, media='video')
            check('video cleanup refused', claim(video), error='22023')
            check('video object ordinary upload unchanged',
                  f"insert into storage.objects(bucket_id,name) values('reels','reels/{OWNER}/1780000000000.mp4');")
            check('cleanup does not grant video delete',
                  f"delete from storage.objects where name='reels/{OWNER}/1780000000000.mp4'; "
                  f"select count(*) from storage.objects where name='reels/{OWNER}/1780000000000.mp4';", '1')
            check('malformed story namespace refused',
                  f"insert into storage.objects(bucket_id,name) values('reels','{OWNER}/stories/not-a-uuid/x.jpg');", error='42501')
            check('other owner story path refused', upload(video, uid=OTHER), uid=OTHER, error='42501')
            check('service story upload rejected despite RLS bypass', upload(video), uid=OWNER, role='service_role', error='42501')
            removed = '30000000-0000-4000-8000-000000000012'
            draft(removed, removed=True)
            check('removed zero-count owned story may retire', claim(removed), 'pending')
            check('removed zero-count owned story may finish', finish(removed), 'discarded')
            legacy = '30000000-0000-4000-8000-000000000013'
            draft(legacy)
            # Old/malformed descendants may predate the new writer guard. Trusted fixture setup
            # bypasses only this trigger to prove finish sees every object under the exact prefix.
            sql('alter table storage.objects disable trigger guard_photo_story_storage_write;')
            sql(f"insert into storage.objects(bucket_id,name) values('reels','{path(legacy,'old-unexpected.png')}');")
            sql('alter table storage.objects enable trigger guard_photo_story_storage_write;')
            check('claim legacy filename story', claim(legacy), 'pending')
            check('legacy unexpected filename prevents finish', finish(legacy), error='55000')
            check('exact claimed prefix permits legacy filename cleanup',
                  f"delete from storage.objects where name='{path(legacy,'old-unexpected.png')}';")
            check('legacy prefix now empty permits finish', finish(legacy), 'discarded')
            closed_story = '30000000-0000-4000-8000-000000000014'
            closed_profile = '20000000-0000-4000-8000-000000000004'
            draft(closed_story, owner=closed_profile)
            # Seed a legitimately claimed draft from before the account became blocked.
            sql(f"update public.profiles set age_blocked_at=null where user_id='{CLOSED}';")
            check('prepare closed-owner story upload', upload(closed_story,uid=CLOSED),uid=CLOSED)
            check('prepare closed-owner story claim', claim(closed_story), 'pending',uid=CLOSED)
            sql(f"update public.profiles set age_blocked_at=now() where user_id='{CLOSED}';")
            check('blocked owner cannot finish own claimed draft', finish(closed_story),uid=CLOSED,error='42501')
            check('blocked owner Storage deletion is filtered',
                  f"delete from storage.objects where name='{path(closed_story,uid=CLOSED)}';",uid=CLOSED)
            check('blocked owner claimed object remains in metadata',
                  f"select count(*) from storage.objects where name='{path(closed_story,uid=CLOSED)}';", '1',uid=None)
            check('helper refuses another bucket',
                  f"select public.can_delete_failed_photo_story_object('avatars','{path(SID)}');", 'f')
            check('helper refuses prefix sibling',
                  f"select public.can_delete_failed_photo_story_object('reels','{OWNER}/stories/{SID}suffix/a.jpg');", 'f')
            check('closed-account restrictive policy preserved',
                  "select count(*) from pg_policy where polname='Closed accounts' and not polpermissive;", '1', uid=None)

            r1 = '30000000-0000-4000-8000-000000000020'
            draft(r1)
            race('in-flight upload commits before claim', upload(r1), claim(r1), 'pending')
            check('claim sees committed in-flight upload', finish(r1), error='55000')
            r2 = '30000000-0000-4000-8000-000000000021'
            draft(r2)
            race('upload waits for cleanup then rejects', claim(r2), upload(r2), None, error='42501')
            r3 = '30000000-0000-4000-8000-000000000022'
            draft(r3)
            publish3 = f"select public.set_reel_photos('{r3}','[{{\"image_path\":\"{path(r3)}\"}}]'::jsonb);"
            race('cleanup waits for publish then preserves live story', publish3, claim(r3), 'published')
            r4 = '30000000-0000-4000-8000-000000000023'
            draft(r4)
            publish4 = f"select public.set_reel_photos('{r4}','[{{\"image_path\":\"{path(r4)}\"}}]'::jsonb);"
            race('publish waits for cleanup then rolls back', claim(r4), publish4, None, error='23514')
            check('cleanup-before-publish remains empty and terminal',
                  f"select photo_count||':'||photo_cleanup_pending from public.reels where id='{r4}';", '0:true')
            r5 = '30000000-0000-4000-8000-000000000024'
            draft(r5)
            check('prepare removal race upload', upload(r5))
            check('prepare removal race claim', claim(r5), 'pending')
            race('finish waits for Storage metadata delete commit',
                 f"delete from storage.objects where name='{path(r5)}';", finish(r5), 'discarded')
            print(f'PASS {passed} synthetic PostgreSQL checks; no hosted Storage-byte acceptance', flush=True)
        finally:
            subprocess.run([str(pg / 'pg_ctl'), '-D', str(data), '-m', 'immediate', '-w', 'stop'],
                           check=True, stdout=subprocess.DEVNULL)


if __name__ == '__main__':
    run()

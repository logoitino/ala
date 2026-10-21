/**
 * Supabase stand-ins for a local Postgres (PGlite): the roles, the auth / storage / realtime schemas, the functions
 * schema.sql calls (auth.uid(), auth.role(), auth.jwt(), storage.foldername(), realtime.topic(), realtime.send()) and Supabase's default
 * privileges. Shared by scripts/replay/schema-replay.mjs (security replay) and scripts/gen-db-types.mjs (database types)
 * so both build the schema on the same base. `auth.role()` behaves like Supabase's: empty when the request carries no
 * JWT claims.
 */
export const SUPABASE_STUBS = String.raw`
  do $$ begin create role anon; exception when duplicate_object then null; end $$;
  do $$ begin create role authenticated; exception when duplicate_object then null; end $$;
  do $$ begin create role service_role bypassrls; exception when duplicate_object then null; end $$;
  do $$ begin create role supabase_auth_admin; exception when duplicate_object then null; end $$;
  create schema if not exists auth; create schema if not exists storage; create schema if not exists realtime;
  create table auth.users (id uuid primary key default gen_random_uuid(), email text, raw_user_meta_data jsonb default '{}'::jsonb, created_at timestamptz default now());
  create function auth.uid() returns uuid language sql stable as $$ select nullif(coalesce(nullif(current_setting('request.jwt.claim.sub', true), ''), nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub'), '')::uuid $$;
  create function auth.role() returns text language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claim.role', true), ''), nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role')::text $$;
  create function auth.jwt() returns jsonb language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb $$;
  create table storage.buckets (id text primary key, name text, public boolean default false, file_size_limit bigint, allowed_mime_types text[], created_at timestamptz default now());
  create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text references storage.buckets(id), name text, owner uuid, metadata jsonb, created_at timestamptz default now());
  alter table storage.objects enable row level security;
  -- Like Supabase's: the folders only, without the file name ('a/b/c.jpg' → {a,b}).
  create function storage.foldername(name text) returns text[] language sql immutable as $$ select (string_to_array(name, '/'))[1:array_length(string_to_array(name, '/'), 1) - 1] $$;
  create table realtime.messages (id bigserial primary key, topic text, extension text, payload jsonb, event text, private boolean default false, inserted_at timestamptz default now());
  alter table realtime.messages enable row level security;
  create function realtime.topic() returns text language sql stable as $$ select current_setting('realtime.topic', true) $$;
  -- Like Supabase's realtime.send: one Broadcast row per call (SCALE-03 trigger). Runs as the caller; the trigger is definer.
  create function realtime.send(payload jsonb, event text, topic text, private boolean default true) returns void language sql as $$ insert into realtime.messages (topic, extension, payload, event, private) values (topic, 'broadcast', payload, event, private) $$;
  do $$ begin create publication supabase_realtime; exception when duplicate_object then null; end $$;
  grant usage on schema auth, storage, realtime, public to anon, authenticated, service_role;
  grant select, insert, update, delete on storage.objects, storage.buckets to anon, authenticated, service_role;
  -- Supabase's default privileges: every table, function and sequence the project creates in public is granted to
  -- all three API roles directly. Without this the replay would under-report what a guest can reach on hosted.
  alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
  alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
  alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
`;

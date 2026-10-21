-- REDUNDANCY-01 synthetic source rows for the parity harness and the local restore drill. No real people or money.
-- Covers an Auth user, athletes, games (realtime), a clip, a donation (which also writes the books and the audit
-- chain through triggers), migration history and a sequence that has been used.
create schema if not exists supabase_migrations;
create table if not exists supabase_migrations.schema_migrations (version text primary key, name text);
insert into auth.users (id, email) values ('00000000-0000-4000-8000-000000000001', 'fan@example.test');
insert into public.players (id, name) values ('00000000-0000-4000-8000-0000000000a1', 'Synthetic Athlete One'),
                                             ('00000000-0000-4000-8000-0000000000a2', 'Synthetic Athlete Two');
insert into public.games (home_team, away_team) values ('Synthetic Home', 'Synthetic Away'), ('North', 'South');
insert into public.reels (video_url, player_id) values ('https://example.test/a.mp4', '00000000-0000-4000-8000-0000000000a1');
insert into supabase_migrations.schema_migrations values ('20260929120000', 'athlete_verification_ladder'),
                                                        ('20261013210000', 'function_access_hardening');
select setval('public.challenge_mutes_id_seq', 42);
insert into public.tips (player_id, amount_cents) values ('00000000-0000-4000-8000-0000000000a1', 2500);

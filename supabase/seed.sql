-- Fake seed data for local Supabase CLI only (`supabase db reset`).
-- NEVER put real athletes, families, schools, emails, phones, or team codes here.
-- Hosted Demo Fan SQL remains reference-only in legacy/demo_fan_account.sql.

-- Synthetic schools (high school + college)
insert into public.schools_and_teams (id, name, mascot, level, division, region, city)
values
  ('00000000-0000-4000-8000-000000000001', 'Riverbend High', 'Otters', 'high_school', 'High School', 'UT', 'Example City'),
  ('00000000-0000-4000-8000-000000000002', 'Cedar College', 'Hawks', 'college', 'NCAA D2', 'Big Sky', 'Sample Town')
on conflict (id) do nothing;

-- Synthetic roster rows (names are placeholders)
insert into public.players (id, name, jersey_number, position, school_name, team)
values
  ('00000000-0000-4000-8000-000000000011', 'Alex Example', 12, 'QB', 'Riverbend High', 'Otters'),
  ('00000000-0000-4000-8000-000000000012', 'Jordan Sample', 7, 'G', 'Cedar College', 'Hawks')
on conflict (id) do nothing;

-- Auth users / profiles intentionally omitted: a local reset must not mint shared passwords.
-- Create a throwaway email user in Studio when you need a signed-in local session.

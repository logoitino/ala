# Tapua'i Diagnostic & Troubleshooting Playbook

## 1. "No player found" or Empty Roster List

- **Cause:** Row Level Security (RLS) is enabled in Supabase without a public `SELECT` policy, or the ID parameter passed via Expo Router doesn't match the database format.

- **Fix:** Run this in Supabase SQL Editor:

  ```sql

  ALTER TABLE public.players ENABLE ROW LEVEL SECURITY;

  DROP POLICY IF EXISTS "Public Can Read Players" ON public.players;

  CREATE POLICY "Public Can Read Players" ON public.players FOR SELECT TO anon, authenticated USING (true);
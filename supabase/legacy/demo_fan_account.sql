-- Soft-Wall Demo Fan (QA). Safe to re-run.
-- App also auto-creates this user on first "Continue as Demo Fan" when Confirm email is off.
-- Credentials: demo@tapuai.app / TapuaiDemoFan1! (override via EXPO_PUBLIC_DEMO_FAN_*).

create extension if not exists pgcrypto;

do $$
declare
  new_id uuid := gen_random_uuid();
begin
  if exists (select 1 from auth.users where email = 'demo@tapuai.app') then
    return;
  end if;

  insert into auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at,
    confirmation_token,
    email_change,
    email_change_token_new,
    recovery_token
  ) values (
    coalesce((select instance_id from auth.users limit 1), '00000000-0000-0000-0000-000000000000'),
    new_id,
    'authenticated',
    'authenticated',
    'demo@tapuai.app',
    crypt('TapuaiDemoFan1!', gen_salt('bf')),
    timezone('utc', now()),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"full_name":"Demo Fan","name":"Demo Fan"}'::jsonb,
    timezone('utc', now()),
    timezone('utc', now()),
    '',
    '',
    '',
    ''
  );

  insert into auth.identities (
    id,
    user_id,
    identity_data,
    provider,
    provider_id,
    last_sign_in_at,
    created_at,
    updated_at
  ) values (
    gen_random_uuid(),
    new_id,
    jsonb_build_object('sub', new_id::text, 'email', 'demo@tapuai.app', 'email_verified', true),
    'email',
    new_id::text,
    timezone('utc', now()),
    timezone('utc', now()),
    timezone('utc', now())
  );

  insert into public.profiles (user_id, full_name, role, roles, active_role)
  values (new_id, 'Demo Fan', 'fan', array['fan']::text[], 'fan')
  on conflict (user_id) do nothing;
end;
$$;

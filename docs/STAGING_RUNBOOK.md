# Staging runbook — first tester build

Closes [ROADMAP.md](ROADMAP.md) Phase 2 item 4. Goal: an installed preview build that talks to a
**separate** Supabase project, can sign people in, and can take a Stripe **test** card.

The current Supabase project stays the development database. Nothing here touches live money.
Steps marked **(you)** need a dashboard login or an account; everything else can be done by an agent
once the keys exist.

## 0. What you need first

| Account | Plan for testers | Why |
| --- | --- | --- |
| Supabase | Free (2 projects per org). Pro ~$25/mo only if the idle-pause gets in the way | The staging project |
| Stripe | Test mode, no plan | `sk_test_` / `pk_test_` keys; Connect turned on in test mode |
| Expo | Free (or Starter for faster builds) | `eas build --profile preview`; project `@logoitino/ala-sports` is already linked |
| Apple Developer | $99/yr | Ad hoc builds need each tester's device UDID; TestFlight removes that limit |

Check prices on each site before paying; the numbers above are rough.

## 1. Create the project (you)

1. Supabase dashboard → New project, e.g. `ala-sports-staging`, same region as development.
2. Settings → API: copy the **Project URL**, the **anon** key, and the project ref (the `xxxx` in
   `https://xxxx.supabase.co`). Keep the service-role key off laptops and out of git.

## 2. Apply the schema

1. SQL Editor → paste all of `apps/mobile/src/backend/db/schema.sql` → Run. It is written to run on a
   blank project and re-run cleanly (Rounds 8 / 11.5). It already includes `clear_reel_hype`, the four
   Storage buckets (`reels`, `game_highlights`, `avatars`, private `reel_vault`) and seed schools,
   games, players and Drip products. It seeds **no reels**, so Highlights is empty until someone uploads.
2. Do **not** run the standalone `supabase/*.sql` files on top — `schema.sql` is canonical.
3. Varsity team codes are not seeded (Round 12). Generate new random codes for staging, set them here
   in the SQL Editor, and hand them to testers directly — never commit them:

   ```sql
   update public.schools_and_teams set team_code = '<random code>' where name = '<school>';
   ```

## 3. Auth (you)

1. Authentication → URL Configuration → add redirect `alasports://auth/callback`.
2. Providers → Email on (password + magic link). Apple / Google only if you will test them.
3. Preview builds have **no Demo Fan button** (`__DEV__` is off), so every tester signs up by email.
   Supabase's built-in mailer only sends a few emails per hour. For more than a handful of
   testers either turn off "Confirm email" on staging or add custom SMTP (Authentication → SMTP).

## 4. First admin

Sign up once in the app (or Authentication → Users → Add user). Then in the SQL Editor:

```sql
update public.profiles set is_admin = true, role = 'admin'
where user_id = '<auth user id>';   -- user_id, not id (Round 21)
```

Leave **Features → Operator console** (`layouts.operatorConsole`) **off**. Game-day gigs are an
upcoming feature (ROADMAP Release waves, Wave 3), not part of the tester build. It is off by default.

## 4b. Starter clips (so the feed isn't empty)

A blank Highlights feed is the worst possible first impression for an app that should feel like
TikTok. Before inviting anyone, sign in on a preview build **as the admin account** and upload 10–15
real clips (Upload button), each tagged to a seeded athlete. Admin uploads land with the tag already
confirmed (so do the athlete's own); anyone else's wait as `pending` until confirmed. Only use clips you have the athlete's
and a parent's OK to show. Give two or three athletes an open Locker goal so testers can try
Chip In.

## 5. Edge Functions + secrets

Checkout (`lib/stripeIntent.ts`) and Connect (`useStripeConnect.ts`) call Edge Functions first, so an
installed build needs **no hosted Expo server** for payments. From the repo root:

```sh
npx supabase login
npx supabase secrets set STRIPE_SECRET_KEY=sk_test_... --project-ref <ref>
npx supabase functions deploy create-payment-intent --project-ref <ref>
npx supabase functions deploy create-stripe-account --project-ref <ref>
```

`SUPABASE_URL`, `SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY` are provided to functions
automatically. **Do not deploy `stripe-webhook` yet** — see Phase 1a; turning it on alongside the
client-side `tips` insert double-credits every tip.

## 6. Point the preview build at staging

`.env.local` is gitignored, so EAS never uploads it. Preview builds only get keys from EAS env vars:

```sh
npx eas-cli env:list --environment preview       # see what the current builds were given
npx eas-cli env:create --environment preview --name EXPO_PUBLIC_SUPABASE_URL --value https://<ref>.supabase.co --visibility plaintext
npx eas-cli env:create --environment preview --name EXPO_PUBLIC_SUPABASE_ANON_KEY --value <anon key> --visibility plaintext
npx eas-cli env:create --environment preview --name EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY --value pk_test_... --visibility plaintext
```

Only `EXPO_PUBLIC_*` values go here — they are baked into the app bundle and are not secrets.
Never put `STRIPE_SECRET_KEY` or the service-role key in EAS build env. Do not set the Demo Fan
variables for preview.

`EXPO_PUBLIC_API_ORIGIN` is only needed if you later host the Metro `/api/*` routes (EAS Hosting).
That is blocked today anyway: EAS Hosting deploys `expo export --platform web`, and web bundling is
broken (STATE.md §5, `lightningcss`). Payouts are hard-disabled (503) regardless.

## 7. Build and hand out

```sh
cd apps/mobile
npx eas-cli build --profile preview --platform android   # APK, any Android phone
npx eas-cli build --profile preview --platform ios       # ad hoc: register tester UDIDs first
```

To add an iPhone: `npx eas-cli device:create`, then rebuild iOS. For more than a few iPhones, set up
TestFlight (`eas build --profile production` + `eas submit`) instead.

## 8. Smoke test before inviting anyone

On a real installed build, against staging:

1. Sign up by email → land signed in.
2. Mālo from an athlete profile with card `4242 4242 4242 4242` → success, `tips` row in staging.
3. Admin account → Expo `/admin` loads; Feedback desk shows a test submission.
4. Upload one Highlight → it appears in the feed.

If step 2 fails with "Payments are not set up in this build yet", the `create-payment-intent`
function is not deployed on the project the build points at.

Then run [TESTER_SCRIPT.md](TESTER_SCRIPT.md).

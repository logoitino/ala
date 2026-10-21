# Admin two-step sign-in (SCALE-01)

**Status (2026-10-18):** built locally, switch **off**. MFA is not enabled on the hosted Supabase
projects and no admin has a factor. Nothing here was run against a hosted project.

Admin desks refuse a session that is not `aal2` (Supabase Auth TOTP) once the switch is on.
With the switch off, sign-in and the desks behave exactly as before.

| Surface | Switch (default off) | Where the check sits |
| --- | --- | --- |
| Next admin portal (`apps/admin-portal`) | `NEXT_PUBLIC_ADMIN_REQUIRE_MFA` in `.env.local` | `middleware.ts` on every request (decodes the `aal` claim of the token `getUser()` just validated) and `app/(protected)/layout.tsx` (re-checks the token with Supabase Auth). A non-`aal2` admin goes to `/login/mfa`. |
| Expo `/admin` (`apps/mobile`) | `EXPO_PUBLIC_ADMIN_REQUIRE_MFA` in `.env.local` or the EAS profile | `components/Admin/AdminShell.tsx` mounts `AdminMfaGate`, which holds every desk back until the session is `aal2`. Studio unlock without an account no longer opens desks while it is on. |

Only `true`, `1`, `on` or `yes` turns a switch on. The shared rule is
`packages/shared-types/admin/adminMfa.ts`; Supabase calls are in `apps/admin-portal/lib/adminMfa*.ts`
and `apps/mobile/src/frontend/lib/adminMfa.ts`.

## Turning it on (owner)

1. **Staging first.** Supabase dashboard → the project → Authentication → Multi-Factor → enable
   **TOTP** (enroll and verify). Leave other factor types off.
2. **Portal:** add `NEXT_PUBLIC_ADMIN_REQUIRE_MFA=true` to `apps/admin-portal/.env.local`, then
   restart `pnpm admin` (Next reads it at start; a hosted portal needs a rebuild).
3. Sign in at `/login`. The portal sends you to **Two-step sign-in**: choose **Set up an
   authenticator app**, scan the QR code (or type the setup key), enter the 6-digit code. Next
   sign-in only asks for the code.
4. Every other admin does step 3 once. Check each can open the portal before you rely on it.
5. **Expo `/admin`:** set `EXPO_PUBLIC_ADMIN_REQUIRE_MFA=true`, restart Metro with `--clear`
   (installed builds need a new build). The same authenticator entry works; it is one factor per
   Supabase account.
6. Then repeat on the next project (development / production) with its own dashboard switch.

**Turning it off / lockout recovery:** remove the variable (or set it to anything else) and
restart. A lost phone: in the Supabase dashboard, Authentication → Users → the user → remove the
factor, then the admin sets it up again. Keep at least one admin able to reach the dashboard.

## What this does not cover

- **Database.** The gate is the admin desks. RLS and `is_admin()` still accept an `aal1` token, so
  an admin's token can call the same RPCs directly. Requiring `aal2` in Postgres
  (`(auth.jwt() ->> 'aal') = 'aal2'` in the admin checks) is a separate migration for `BACKEND` +
  `RLS_SECURITY`, after every admin has a factor. Not written.
- **Off-host append-only audit log** (HOSTING_DECISION_BRIEF §7.2): needs hosted infrastructure.
  Not built.
- **MFA on the Supabase, GitHub and Expo accounts:** owner work in each provider's settings.
- **Recovery codes / a second factor:** not offered; recovery is the dashboard step above.

## Not verified

No hosted project has TOTP on, so enroll / challenge / verify have never run against Supabase Auth.
Not checked: the portal page in a browser, the Expo gate on web or a device (QR rendering through
`react-native-svg` `SvgXml`), screen readers, and a token refresh keeping `aal2`. Unit tests cover the
rule, the switch defaults and the wrappers with synthetic tokens.

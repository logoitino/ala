# Expo HAS CHANGED

Read the exact versioned docs at [https://docs.expo.dev/versions/v57.0.0/](https://docs.expo.dev/versions/v57.0.0/) before writing any code.

## Tapua'i Sports - Project Architecture & Conventions

### Directory Hierarchy Rules

- `app/` -> EXPO ROUTER DIRECTORY ONLY. Contains navigation layout files `_layout.tsx`) and tab routes `(tabs)`).
- `src/frontend/components/` -> Reusable UI components `PlayCard`, `ScoreHeader`, `TipSheetModal`).
- `src/frontend/context/` -> Global React Contexts `AuthContext`, `GameContext`).
- `src/frontend/hooks/` -> Custom hooks `useLiveFeed`, `useStripePayment`).
- `src/frontend/lib/` -> Client SDK instances `supabase.ts`, `stripe.ts`).
- `src/backend/api/` -> Expo Server Routes `create-payment-intent+api.ts`).
- `src/backend/db/` -> SQL schemas `schema.sql`) and Row Level Security rules `rls_policies.sql`).



### Tech Stack & Guardrails

1. **Frontend:** React Native (Expo Router), TypeScript, NativeWind/Tailwind.
2. **Backend & Realtime:** Supabase PostgreSQL, Supabase Realtime WebSockets.
3. **Payments:** Stripe Connect `@stripe/stripe-react-native`) + Server API Routes.
4. **Environment Variables:** Client keys must start with `EXPO_PUBLIC_`.


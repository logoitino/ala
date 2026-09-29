# Hooks

Feature-facing state and lifecycle orchestration.

- Hook names start with `use` and files use camelCase.
- Network work belongs in `lib/`; hooks compose it with loading, error, refresh, subscriptions, and optimistic state.
- Return errors explicitly. A failed request must not look like an empty result.
- Clean up Realtime channels, timers, and AppState listeners.
- Every custom hook needs the project JSDoc header, including network and subscription side effects.
- Tests should prove initial load, failure/retry, cleanup, and any graceful fallback for unapplied SQL.

Routes and components should consume hooks rather than importing the Supabase client.

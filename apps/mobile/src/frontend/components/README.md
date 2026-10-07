# Components

Reusable React Native UI, grouped by the feature that consumes it.

- Put a one-feature component in that feature's PascalCase folder (`Reels/`, `Profile/`, `Local/`, `Admin/`).
- Put generic primitives in `UI/`.
- Keep a component flat only when unrelated features genuinely share it; the allowed flat set is listed in `docs/engineering/CONVENTIONS.md`.
- Components render state and call hooks/helpers. They do not query Supabase directly.
- Complex components need the project JSDoc header (`@purpose`, parameters, return value, side effects).
- Co-locate focused tests in `__tests__/` and test error, empty, loading, and successful states separately.

Before adding a folder or cross-cutting component, update `AGENTS.md` so the directory map remains accurate.

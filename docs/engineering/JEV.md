<!-- Owner standing protocol: include Jev on complex product/code decisions. -->
# Jev — TypeSafe decision helper

**Owner instruction (2026-10-28):** Always include **Jev** on more complex decisions so
choices land faster and the resulting code stays smaller and clearer. Jev is the TypeSafe
SDK scorer in `jev/` (`typesafe-sdk`). It is a **decision aid**, not a registry agent, not
counsel, and not proof that a change shipped.

## When to call Jev

Use Jev when any of these is true:

- Two or more plausible product / UX / implementation options
- A naming, layout, copy-tone, or interaction choice that will spread across files
- A simplification / refactor fork (keep current vs shorter shape)
- A complex agent handoff where the CTO/lead needs a scored pick before coding

Skip Jev for one-line typo fixes, pure doc sync, mechanical CI gate repairs, and paths that
must not leave the machine (see below).

## What never goes to Jev

Do not send:

- Secrets, API keys, `.env`, Stripe/Supabase service material
- Customer / family / athlete personal data or production rows
- Full source dumps of money, payout, auth, legal, or RLS-critical modules as the brief
  (summarize options in product language; keep sensitive code local)

If the network or key is unavailable, **record the miss** (STATE / task tracker: “Jev not
reached”) and continue with the lead’s best judgment — do not block the whole task forever,
and do not invent a fake Jev score.

## How to call it

1. Write a short JSON/spec brief: the decision, 2–N labeled options, constraints (VOICE,
   Wave 0 spend, no new gift cut, etc.).
2. Prefer the Mac Claude route: `~/bin/jev-ask spec.json` (uses this repo’s `jev/` SDK,
   Python 3.12, and `jev/.env` with `TYPESAFE_API_KEY`). See STATE §3.
3. Local smoke: copy `jev/.env.example` → `jev/.env`, install `jev/requirements.txt`, run
   `jev/test_jev.py` only to confirm the key works.
4. Apply a pick only when confidence is high enough for the stakes. Historical bar used on
   this project: **keep current code unless confidence ≥ ~0.90** on a replace/simplify;
   product UI picks sometimes shipped at lower confidence with the score recorded. Always
   write the choice, confidence/probability, and token counts into STATE §4 or the task
   tracker when Jev ran.

## After Jev answers

- Implement the chosen option (or keep current if below the bar)
- Run the focused tests / `pnpm check` slices you already owe
- Same-turn docs if architecture, copy, or ownership moved
- Name Jev in the receipt so the next session does not re-litigate the same fork

## Related

- STATE §3 (environment gotchas, `~/bin/jev-ask`)
- [TEAMS.md](../agents/TEAMS.md) specialist operating contract (Jev on complex decisions)
- [AGENTS.md](../../AGENTS.md) standing rule
- TypeSafe console for keys: vendor page (do not invent pricing here; Wave 0 spend rules still apply)

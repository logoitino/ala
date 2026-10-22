<!-- Keep Claude's entry point current while importing the canonical rules instead of duplicating them. -->
@docs/STATE.md
@AGENTS.md

# Claude — Tapua'i Sports

**Last reviewed: 2026-10-22.** Read `docs/STATE.md` §0 and §6, `AGENTS.md`, and
[engineering conventions](docs/engineering/CONVENTIONS.md) before changes.
The imported documents are the source of truth for this checkout; dated receipts describe
their original branch and source, not every build or hosted environment.

## Current reading path

- [COORD-02](docs/agents/COORD-02.md): current gift-release work, 115 role instructions,
  original verification receipts and remaining owners. Use the registry and existing leads;
  definitions do not prove that specialists ran or approved a release.
- [VOICE](docs/product/VOICE.md): individual **Gift / Give / Send a gift**, program **Donation**,
  **Tip Tapua'i (optional)** and **Cover the processing fee**. Keep paid Subscription/Purchase
  separate and preserve internal identifiers and signed/historical records.
- [Gift/tip rollout](docs/engineering/GIFT_TIP_ROLLOUT.md): the `codex/tip-model` source removes
  the gift cut in both flag states. `MONETIZATION_TIPS_ENABLED` defaults OFF and gates optional
  extras/copy only. Local gross liability is not proof of actual fees or bank settlement.
- [Counsel packet](docs/legal/GIFT_RELEASE_COUNSEL_PACKET.md): final Terms, guardian consent,
  gift-linked Aura and store/payment claims still require review. Drafts are not accepted terms.
- [IP plan](docs/legal/IP_PROTECTION_PLAN.md): maintain source-bound copyright/patent intake
  with `pnpm ip:sync`; counsel and owner decide rights, sharing and filings.

## Before handoff

Run `pnpm check` under Node 24 and follow the imported same-turn documentation, data,
feature/admin and source-custody rules. Record the actual branch/commit, checks and gaps.
A local commit, GitHub publication, hosted deployment and release approval are separate facts;
verify the remote result before reporting that GitHub was updated.

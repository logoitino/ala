# Family fun build decisions

Local implementation rulings for FUN-01 and QUIZ-01 in `codex/fan-zone`.
The owner approved the recommended build and added weekly sport quizzes. These decisions
make that direction concrete; they do not approve a hosted launch or settle jurisdictional law.

| Decision | Reason | Cost if the decision needs changing |
| --- | --- | --- |
| Keep the plan in engineering/design. | Repository instructions place feature designs there. | Tools expecting a different default need the explicit plan path. |
| Fan awards first appear as a results recap. | Free ballots select recognition without creating another reward ledger. | Persistent fan badges, Aura and money need separate criteria, safety and product review. |
| Deliver Fan Zone media through an authorized revocable API. | Each request checks current permission; no reusable signed URL is issued. | Hosting, bounded delivery costs, device playback and provider behavior need proof. Already delivered copies cannot be recalled. |
| Award the private Sport Learner badge for completion, including an incorrect answer. | Explanations encourage learning without pressure or paid advantage. | A mastery badge would need different criteria, copy and stored completion rules. |
| Start both features paused/draft with an empty testing cohort of at most100 canonical accounts. | A bounded pilot gives review and support a workable first workload. | Enrollment adds friction; widening requires reviewed controls and staffing. |
| Reuse existing delegated threads after the thread limit. | Complete scoped implementation and independent review within available capacity. | Inherited context requires full briefs, explicit ownership and independently bound receipts. |
| Give new audit ownership to RLS_SECURITY. | It is an existing accountable role; no AUDIT role is registered. | Review workload may need reassignment within the existing team. |
| Fence Storage catalog writes, including service writes. | Obsolete, verified, withdrawn and removal revisions must resist later overwrites. | Hosted provider compatibility and physical Storage compensation remain release checks. |
| Put the two activities on root routes with explicit Back and account Home. | All eligible account roles can use them without adding bottom tabs. | Full layout redirects, device navigation and accessibility still need verification. |
| Keep legacy malformed quiz rows visible for admin correction, while denying unsafe questions. | Staff can pause/archive/void without silently losing the correction desk. | More warning and unavailable states must be maintained; corrections need an audit trail. |
| Build a bounded in-screen Help & Safety section for Fan Zone. | No existing general Help/Safety route was found; use real concern/status controls and authorized configured contact. | A staffed public contact/intake fallback for guests requires a separate reviewed source before release. Policy information does not receive reports. |
| Use composite timestamp/ID paging cursors for Fan cases and audit. | Existing insert guards protect normal writes; explicit cursors also tolerate legacy/import ties after privileged recovery. | The RPC cursor signature and client validation change together; hosted compatibility needs a coordinated migration. |
| Allow an optional canonical campaign ID on the Fan route. | A guardian CTA keeps the reviewed campaign context even if the latest visible campaign changes. | Additional route validation and stale-context tests are needed; the server still decides access. |

## Release handoff

[Fan design](../design/FAN_ZONE_DESIGN.md), [quiz design](../design/SPORT_POP_QUIZ_DESIGN.md),
[Fan ledger](../../agents/FUN-01.md) and [quiz ledger](../../agents/QUIZ-01.md) retain owners,
checks and remaining work. Local source tests do not prove legal guardian identity, sport facts,
real-world moderation capacity, hosted deletion, payment eligibility or growth uplift.

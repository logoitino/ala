#!/usr/bin/env bash
# Stop-hook guard (REDUNDANCY-02): keep the move-off-Supabase plan in step with the app, automatically.
#
# At the end of every Claude session this regenerates docs/engineering/EXIT_INFRASTRUCTURE_MAP.md (new plan version
# when the app changed). If the change touches something the exit plan depends on and has not been announced to the
# Redundancy & Exit team, it pushes back once so the session runs `pnpm exit:map --acknowledge --by "<session>"`,
# which writes the routed notice to docs/agents/EXIT_CHANGE_LOG.md.
#
# CI and `pnpm check` enforce the same rule for every other tool (Codex, Cursor, people) via `pnpm exit:map:check`.
# Contract: exit 2 + stderr asks the agent to keep working; exit 0 lets it stop. Fires at most once per stop cycle
# (`stop_hook_active`), and never blocks when Node or the script is unavailable.
set -uo pipefail

payload="$(cat 2>/dev/null || true)"
repo="$(git rev-parse --show-toplevel 2>/dev/null)" || exit 0
cd "$repo" || exit 0
[ -f scripts/exit-map.mjs ] || exit 0

node_bin="$(command -v node 2>/dev/null || true)"
[ -n "$node_bin" ] || node_bin="$HOME/.local/node/bin/node"
[ -x "$node_bin" ] || exit 0

# Always regenerate, even on the second pass, so the map on disk matches the code.
"$node_bin" scripts/exit-map.mjs >/dev/null 2>&1 || true

# Capture exact current source at session end even when a background watcher is unavailable.
# A concurrent capture can defer this attempt; this never acknowledges changes or claims data readiness.
if [ -f infrastructure/exit/sync.mjs ]; then
  if ! "$node_bin" infrastructure/exit/sync.mjs ensure >/dev/null; then
    echo "The exit source copy failed to refresh. Check pnpm exit:sync:status and repair the failed capture." >&2
    case "$payload" in
      *'"stop_hook_active":true'*|*'"stop_hook_active": true'*) exit 0 ;;
    esac
    exit 2
  fi
fi

case "$payload" in
  *'"stop_hook_active":true'*|*'"stop_hook_active": true'*) exit 0 ;;
esac

summary="$("$node_bin" scripts/exit-map.mjs --pending 2>/dev/null)"
status=$?
[ "$status" -eq 3 ] || exit 0

{
  echo "The exit plan changed: $summary."
  echo
  echo "The Redundancy & Exit team (EXIT_SYNC) must hear about it. Review section 2 of"
  echo "docs/engineering/EXIT_INFRASTRUCTURE_MAP.md, then run:"
  echo "  pnpm exit:map --acknowledge --by \"<this session>\""
  echo "That records a routed notice in docs/agents/EXIT_CHANGE_LOG.md and moves the baseline."
  echo "If a coverage rule fails (Edge Function not in the self-host allowlist, unmapped Auth method),"
  echo "fix docs/engineering/exit-map.json or infrastructure/supabase/configure.py first."
} >&2
exit 2

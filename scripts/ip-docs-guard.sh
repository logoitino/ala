#!/usr/bin/env bash
# Claude Stop refreshes factual IP evidence without running a paid agent or changing counsel decisions.
# Failure requests repair once; other tools use the same local pnpm check path.
set -uo pipefail
payload="$(cat 2>/dev/null || true)"
repo="$(git rev-parse --show-toplevel 2>/dev/null)" || exit 0
cd "$repo" || exit 0
node_bin="$(command -v node 2>/dev/null || true)"
[ -n "$node_bin" ] || node_bin="$HOME/.local/node/bin/node"
if [ ! -x "$node_bin" ]; then
  echo "IP documentation refresh unavailable: Node 24 required; run pnpm ip:sync and ip:check." >&2
  exit 0
fi
if "$node_bin" scripts/ip-docs.mjs && "$node_bin" scripts/ip-docs.mjs --check; then
  exit 0
fi
echo "IP packet refresh/check failed. DOCUMENTATION must repair input/source and rerun ip:sync/ip:check; legal evidence remains pending." >&2
case "$payload" in
  *'"stop_hook_active":true'*|*'"stop_hook_active": true'*) exit 0 ;;
esac
exit 2

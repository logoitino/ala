#!/usr/bin/env bash
# Stop-hook guard: if this session changed code under apps/, packages/ or supabase/ but left
# docs/STATE.md alone, push back once so the state doc does not silently go stale.
#
# CI enforces the same rule on pull requests (.github/workflows/ci-checks.yml). This is the
# local half, for agents that never open one.
#
# Contract: exit 2 + stderr asks the agent to keep working. Exit 0 lets it stop.
# It fires at most once per session — if Claude is already responding to this hook
# (`stop_hook_active`), we let it go rather than risk a loop.
set -uo pipefail

payload="$(cat 2>/dev/null || true)"
case "$payload" in
  *'"stop_hook_active":true'*|*'"stop_hook_active": true'*) exit 0 ;;
esac

repo="$(git rev-parse --show-toplevel 2>/dev/null)" || exit 0
cd "$repo" || exit 0

# Mode-bit-only churn is endemic in this checkout (see docs/STATE.md §3), so ignore the mode bit
# and compare content. Tracked edits come from `git diff`, new files from `ls-files --others`;
# both print one path per line, so renames and paths with spaces survive intact.
git_c() { git -c core.fileMode=false "$@" 2>/dev/null; }
changed="$(
  {
    git_c diff --name-only HEAD -- apps packages supabase
    git_c ls-files --others --exclude-standard -- apps packages supabase
  } | sort -u
)"
[ -n "$changed" ] || exit 0

if [ -n "$(git_c diff --name-only HEAD -- docs/STATE.md; git_c ls-files --others --exclude-standard -- docs/STATE.md)" ]; then
  exit 0
fi

{
  echo "docs/STATE.md was not updated, but these paths changed in this session:"
  echo "$changed" | head -20
  echo
  echo "Before finishing: add a line to docs/STATE.md section 4 (Recent changes) describing what"
  echo "you did, and bump the 'Last updated' header. If you also hit an environment gotcha or"
  echo "found something broken, record it in section 3 or 5 so the next agent does not rediscover it."
} >&2
exit 2

#!/usr/bin/env bash
# Reviews only the latest commit with Codex's built-in reviewer.
# A working-tree review would also send untracked, unpublished drafts.
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"

companion=$(ls -d "$HOME"/.claude/plugins/cache/openai-codex/codex/*/scripts/codex-companion.mjs 2>/dev/null | sort -V | tail -1 || true)
if [ -z "$companion" ]; then
  echo "Codex plugin not found under ~/.claude/plugins/cache/openai-codex" >&2
  exit 2
fi

node "$companion" review --wait --base HEAD~1

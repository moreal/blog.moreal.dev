#!/usr/bin/env bash
# Writes .claude/refactor-ledger.md unless it already exists.
# Order: modules others depend on first, stylesheets last.
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"

ledger=.claude/refactor-ledger.md
if [ -e "$ledger" ]; then
  echo "ledger exists: $ledger"
  exit 0
fi

list_sources() {
  local directory=$1 depth=$2
  find "$directory" -maxdepth "$depth" -type f \
    \( -name '*.ts' -o -name '*.tsx' -o -name '*.astro' \) \
    ! -name '*.test.ts' ! -name '*.d.ts' | LC_ALL=C sort
}

{
  echo "# 리팩터링 장부"
  echo
  echo '`[ ]` 대기 · `[x]` 완료 · `[-]` 손댈 것 없음 · `[!]` 보류'
  echo
  for group in \
    "src/lib 9" "src/admin/shared 9" "src/admin/lib 9" \
    "src/admin/api 9" "src/pages 9" \
    "src/components 9" "src/admin/ui 9" \
    "src/admin/pages 9" "src/admin 1"; do
    read -r directory depth <<<"$group"
    list_sources "$directory" "$depth"
  done | sed 's/^/- [ ] /'
  find src -type f \( -name '*.css' -o -name '*.scss' \) | LC_ALL=C sort | sed 's/^/- [ ] /'
} >"$ledger"

echo "created $ledger: $(grep -c '^- \[ \]' "$ledger") files"

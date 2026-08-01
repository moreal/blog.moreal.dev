#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

if [ $# -lt 1 ]; then
  echo "usage: $0 <slug> [ko-Hang|ko-Kore|en]" >&2
  exit 1
fi
slug="$1"
lang="${2:-ko-Hang}"
case "$lang" in
  ko-Hang | ko-Kore | en) ;;
  *)
    echo "usage: $0 <slug> [ko-Hang|ko-Kore|en]" >&2
    exit 1
    ;;
esac

now="$(scripts/get-now.sh)"
today="${now%%T*}"
year="${today%%-*}"
rest="${today#*-}"
month="${rest%%-*}"

path="$year/$month/$slug.$lang.md"
if [ -e "$path" ]; then
  echo "already exists: $path" >&2
  exit 1
fi
mkdir -p "$year/$month"
cat > "$path" << EOF
---
published: $now
type: review
book:
  title:
  author:
---

TODO
====
EOF
echo "$path"
if [ -n "${EDITOR:-}" ]; then
  exec "$EDITOR" "$path"
fi

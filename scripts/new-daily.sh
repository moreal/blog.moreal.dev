#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

lang="${1:-ko-Hang}"
case "$lang" in
  ko-Hang | ko-Kore | en) ;;
  *)
    echo "usage: $0 [ko-Hang|ko-Kore|en]" >&2
    exit 1
    ;;
esac

now="$(scripts/get-now.sh)"
today="${now%%T*}"
year="${today%%-*}"
rest="${today#*-}"
month="${rest%%-*}"
day="${rest#*-}"
m=$((10#$month))
d=$((10#$day))

case "$lang" in
  ko-Hang) title="${year}년 ${m}월 ${d}일" ;;
  ko-Kore) title="${year}年 ${m}月 ${d}日" ;;
  en) title="$today" ;;
esac

# The setext underline matches the title's display width, where a CJK
# character (3 bytes in UTF-8) occupies two columns, as hongdown formats it.
bytes=$(printf '%s' "$title" | wc -c | tr -d ' ')
ascii=$(printf '%s' "$title" | LC_ALL=C tr -dc '\000-\177' | wc -c | tr -d ' ')
width=$((ascii + (bytes - ascii) / 3 * 2))
underline="$(printf '%*s' "$width" '' | tr ' ' '=')"

path="$year/$month/$today.$lang.md"
if [ -e "$path" ]; then
  echo "already exists: $path" >&2
  exit 1
fi
mkdir -p "$year/$month"
cat > "$path" << EOF
---
published: $now
type: daily
---

$title
$underline
EOF
echo "$path"
if [ -n "${EDITOR:-}" ]; then
  exec "$EDITOR" "$path"
fi

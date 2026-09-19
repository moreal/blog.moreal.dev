#!/usr/bin/env bash
# build-diff.sh snapshot   build the site and keep public_html as the baseline
# build-diff.sh compare    build again and compare against the baseline
#
# compare prints one verdict line and exits:
#   0 IDENTICAL    every output file is byte-identical
#   0 BUNDLE-ONLY  pages identical once asset hashes are normalized; _astro/ changed
#   1 DIFFERS      pages differ; the differing files follow
#   2              build failed or no baseline
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"

cache=node_modules/.cache/refactor-build
baseline=$cache/baseline

build_site() {
  mkdir -p "$cache"
  if ! yarn build >"$cache/build.log" 2>&1; then
    tail -30 "$cache/build.log" >&2
    exit 2
  fi
}

pages_with_normalized_hashes() {
  local source=$1 target=$2
  rm -rf "$target"
  cp -R "$source" "$target"
  rm -rf "$target/_astro"
  find "$target" -type f \( -name '*.html' -o -name '*.xml' -o -name '*.css' -o -name '*.js' -o -name '*.json' \) -print0 |
    xargs -0 perl -pi -e 's#(_astro/[\w.-]+?)\.[\w-]{8}\.(js|css)#$1.HASH.$2#g'
}

case "${1:-}" in
  snapshot)
    build_site
    rm -rf "$baseline"
    cp -R public_html "$baseline"
    echo "baseline saved: $(find "$baseline" -type f | wc -l | tr -d ' ') files"
    ;;
  compare)
    if [ ! -d "$baseline" ]; then
      echo "no baseline; run snapshot first" >&2
      exit 2
    fi
    build_site
    pages_with_normalized_hashes "$baseline" "$cache/baseline-pages"
    pages_with_normalized_hashes public_html "$cache/current-pages"
    if ! diff -rq "$cache/baseline-pages" "$cache/current-pages" >"$cache/pages.diff"; then
      echo "DIFFERS"
      cat "$cache/pages.diff"
      echo "details: diff -ru $cache/baseline-pages $cache/current-pages"
      exit 1
    fi
    if diff -rq "$baseline" public_html >/dev/null; then
      echo "IDENTICAL"
    else
      echo "BUNDLE-ONLY"
      diff -rq "$baseline/_astro" public_html/_astro || true
    fi
    ;;
  *)
    echo "usage: $0 snapshot|compare" >&2
    exit 2
    ;;
esac

#!/usr/bin/env bash
# Builds the submission .zip and enforces the competition's hard rules.
set -euo pipefail
cd "$(dirname "$0")/.."

OUT="dist/depth-rush.zip"
mkdir -p dist
rm -f "$OUT"

fail() { echo "FAIL: $1" >&2; exit 1; }

[ -f index.html ] || fail "index.html must exist at the top level"

# No external network requests at runtime: no absolute http(s) URLs in shipped code.
if grep -rInE "https?://" index.html src/ 2>/dev/null | grep -v "^\s*//"; then
  fail "absolute URL found in shipped code — all references must be relative"
fi
for kw in "fetch(" "XMLHttpRequest" "WebSocket" "importScripts" "navigator.sendBeacon"; do
  if grep -rIn --fixed-strings "$kw" index.html src/ >/dev/null 2>&1; then
    fail "network API '$kw' found in shipped code"
  fi
done

zip -rq "$OUT" index.html src vendor assets -x '.*' -x '*/.*'

BYTES=$(wc -c < "$OUT" | tr -d ' ')
MB=$(( BYTES / 1048576 ))
[ "$BYTES" -lt 36700160 ] || fail "zip is ${MB}MB, limit is 35MB"

# index.html must sit at the top level of the archive.
# (Listing is captured first: grep -q under `set -o pipefail` would SIGPIPE unzip.)
LISTING=$(unzip -l "$OUT")
grep -qE " index\.html$" <<< "$LISTING" || fail "index.html is not at the zip top level"

echo "OK  $OUT  (${BYTES} bytes, ~${MB}MB)"
tail -n 4 <<< "$LISTING"

#!/usr/bin/env bash
# Puts the built frame (dist/) on Cloudflare Pages: https://<PROJECT>.pages.dev/frame/
#
#   npm run frame:deploy                      # from test-liveops-wrapper: builds, then this
#   PROJECT=my-frame npm run frame:deploy     # another Pages project
#
# Needs `npx wrangler login` once. Creates the Pages project the first time.
set -euo pipefail

PROJECT="${PROJECT:-test-liveops-frame}"
HERE="$(cd "$(dirname "$0")/.." && pwd)"

if [ ! -f "$HERE/dist/frame/index.html" ]; then
  echo "No build in dist/: run  npm run frame:deploy  from test-liveops-wrapper (it builds first)." >&2
  exit 1
fi
if [ -d "$HERE/dist/test-liveops-assets/.git" ]; then
  echo "dist/ still holds the assets' .git: rebuild with  npm run build:frame." >&2
  exit 1
fi

export WRANGLER_SEND_METRICS=false
WRANGLER=(npx --yes wrangler@4)
if "${WRANGLER[@]}" whoami </dev/null 2>&1 | tee /dev/stderr | grep -qi "not authenticated"; then
  echo "Not logged in to Cloudflare: run  npx wrangler login  and then this again." >&2
  exit 1
fi
if ! "${WRANGLER[@]}" pages project list </dev/null 2>/dev/null | grep -qw "$PROJECT"; then
  echo "Creating the Pages project ${PROJECT}..."
  "${WRANGLER[@]}" pages project create "$PROJECT" --production-branch main </dev/null
fi
"${WRANGLER[@]}" pages deploy "$HERE/dist" --project-name "$PROJECT" --branch main --commit-dirty=true </dev/null

echo
echo "The frame:  https://${PROJECT}.pages.dev/frame/"
echo "On its own: https://${PROJECT}.pages.dev/frame/?game=daily-wheel&tier=Diamond"

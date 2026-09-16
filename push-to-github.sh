#!/usr/bin/env bash
# PharmRound — one-command GitHub push.
#
# Usage:
#   GH_TOKEN=github_pat_xxx  bash push-to-github.sh
#
# Pushes the current branch to origin (github.com/organiciraq1992-cmd/pharmround).
# The token is read from the environment, never written to .git/config or any file.
set -euo pipefail

: "${GH_TOKEN:?Set GH_TOKEN before running, e.g.  GH_TOKEN=github_pat_xxx bash push-to-github.sh}"

REMOTE_URL="https://x-access-token:${GH_TOKEN}@github.com/organiciraq1992-cmd/pharmround.git"

echo "→ Pushing to organiciraq1992-cmd/pharmround …"
git push "$REMOTE_URL" HEAD:main --force-with-lease || \
  git push "$REMOTE_URL" HEAD:main

echo "✓ Done. View at: https://github.com/organiciraq1992-cmd/pharmround"

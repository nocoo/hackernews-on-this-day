#!/usr/bin/env bash
set -euo pipefail

cd "$(git rev-parse --show-toplevel)"
existing=$(git config --get core.hooksPath || true)
if [[ -n "$existing" && "$existing" != .githooks ]]; then
  echo "Refusing to replace existing hooks path: $existing" >&2
  exit 1
fi
git config --local core.hooksPath .githooks
printf 'Installed quality hooks at .githooks\n'

#!/usr/bin/env bash
set -euo pipefail

stage=${1:?stage required}
: "${GATE_REPO:?repository required}" "${GATE_TMP:?temporary directory required}"
command -v timeout >/dev/null || { echo "quality gate: timeout is required" >&2; exit 1; }
command -v bun >/dev/null || { echo "quality gate: bun is required" >&2; exit 1; }
command -v node >/dev/null || { echo "quality gate: node is required" >&2; exit 1; }
command -v gitleaks >/dev/null || { echo "quality gate: gitleaks is required" >&2; exit 1; }
expected_bun=$(awk -F '"' '/^bun = / {print $2}' .mise.toml)
expected_node=$(awk -F '"' '/^node = / {print $2}' .mise.toml)
[[ -n "$expected_bun" && "$(bun --version)" == "$expected_bun" ]] || { echo "quality gate: Bun version mismatch" >&2; exit 1; }
[[ -n "$expected_node" && "$(node --version)" == "v$expected_node" ]] || { echo "quality gate: Node version mismatch" >&2; exit 1; }
[[ "$(gitleaks version)" == "8.30.1" ]] || { echo "quality gate: gitleaks 8.30.1 is required" >&2; exit 1; }

run() {
  local name=$1 seconds=$2
  shift 2
  printf '\n▸ %s\n' "$name"
  timeout "${seconds}s" "$@"
}

if [[ "$stage" == pre-commit ]]; then
  : "${GATE_INDEX_FILE:?index path required}"
  run 'G1: staged secrets' 30 env GIT_INDEX_FILE="$GATE_INDEX_FILE" gitleaks git --staged --no-banner --redact "$GATE_REPO"
elif [[ "$stage" == pre-push ]]; then
  : "${GATE_RANGE:?push range required}"
  command -v osv-scanner >/dev/null || { echo "quality gate: osv-scanner is required" >&2; exit 1; }
  osv_version=$(osv-scanner --version | awk 'NR == 1 {print $NF}')
  node -e 'const [major, minor] = process.argv[1].split(".").map(Number); if (!Number.isInteger(major) || !Number.isInteger(minor) || major < 2 || (major === 2 && minor < 5)) process.exit(1)' "$osv_version" || { echo "quality gate: osv-scanner >= 2.5 is required" >&2; exit 1; }
  run 'G1: pushed secrets' 60 gitleaks git --log-opts="$GATE_RANGE" --no-banner --redact "$GATE_REPO"
else
  echo "quality gate: invalid stage" >&2
  exit 1
fi

export NO_COLOR=1
export BUN_CONFIG_REGISTRY="${BUN_CONFIG_REGISTRY:-https://packagefeedproxy.microsoft.io/npm/}"
export TMPDIR="$GATE_TMP"
export XDG_CACHE_HOME="$GATE_TMP/cache"
export XDG_STATE_HOME="$GATE_TMP/state"
mkdir -p "$TMPDIR" "$XDG_CACHE_HOME" "$XDG_STATE_HOME"
run 'Frozen dependency install' 45 bun install --frozen-lockfile
run 'S1: Types' 30 bun run typecheck
run 'S2: Lint' 30 bun run lint
if [[ "$stage" == pre-commit ]] && printf '%s\n' "${GATE_STAGED_FILES:-}" | grep -q '^.github/workflows/'; then
  command -v actionlint >/dev/null || { echo "quality gate: actionlint is required" >&2; exit 1; }
  run 'S3: Workflow' 30 bun run workflow:lint
fi
run 'L1: Unit and coverage' 45 bash -c '
  set -euo pipefail
  bun run test:coverage | tee "$1"
  grep -Eq "Tests[[:space:]]+[1-9][0-9]* passed" "$1"
  test -s coverage/lcov.info
  grep -q "^SF:src/calendar.ts$" coverage/lcov.info
  grep -q "^SF:src/i18n.ts$" coverage/lcov.info
  ! grep -Eq "Tests.*[1-9][0-9]* skipped" "$1"
  bun run test:deployment | tee "$2"
  grep -Eq "tests[[:space:]]+[1-9][0-9]*" "$2"
  grep -Eq "skipped[[:space:]]+0" "$2"
' _ "$GATE_TMP/l1.log" "$GATE_TMP/deployment.log"

if [[ "$stage" == pre-push ]]; then
  run 'G2: Dependencies' 120 osv-scanner scan --lockfile=bun.lock
  run 'B1: Build' 60 bun run build
  run 'L3: Integration' 90 bash -c '
    set -euo pipefail
    bun run test:integration | tee "$1"
    grep -Eq "Tests[[:space:]]+[1-9][0-9]* passed" "$1"
    ! grep -Eq "Tests.*[1-9][0-9]* skipped" "$1"
  ' _ "$GATE_TMP/l3.log"
  run 'L4: E2E' 180 bash -c '
    set -euo pipefail
    bun run test:browser | tee "$1"
    grep -Eq "[1-9][0-9]* passed" "$1"
    ! grep -Eq "[1-9][0-9]* skipped" "$1"
  ' _ "$GATE_TMP/l4.log"
fi
printf '\n✓ %s quality gate passed\n' "$stage"

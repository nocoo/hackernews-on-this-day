# Hacker News On This Day

Bilingual Vite/React site with a Node HTTP API and DuckDB querying a separately mounted Hacker News Parquet archive (application code: MIT; dataset: separately licensed).
Docs: [README.md](README.md) · [Data Layout](data/README.md) · [Retrospective](Retrospective.md)

## Commands

Run from root with `.mise.toml` versions (Bun `1.4.4`, Node `26.13.0`). Browser tests require Playwright Chromium or `CHROME_PATH` pointing to an existing Chromium/Chrome executable.

```sh
bun install --frozen-lockfile
bun run hooks:install      # configure core.hooksPath=.githooks
bun run dev                # https://hntoday.dev.hexly.ai -> 127.0.0.1:7065
bun run check              # S1 typecheck + S2 lint (Biome 0 warnings + focused/skipped-test guard)
bun run workflow:lint      # S3 actionlint + immutable 40-char external action SHAs
bun run test:coverage      # L1 unit coverage (>=90/85% on core 4 files)
bun run test:deployment    # L1 deployment-verifier & remote-verify unit tests
bun run test:integration   # L3 build + isolated prod server & generated Parquet on ephemeral port
bun run test:browser       # L4 build + isolated prod server, mocked UI & real Parquet on :27065
bun run test:container     # Docker smoke: unique image, read-only fixture, revision/data check, cleanup
bun run build              # B1 Vite client + production server
git diff --check
```

Pass `BUN_CONFIG_REGISTRY` when running `bun run test:container` to forward `NPM_REGISTRY` into the Docker build.

## Invariants

- **Version authority**: Root `package.json` is authoritative; the site and `/api/live` derive their version from it. Keep `CHANGELOG.md` and release tags synchronized.
- **Archive boundaries**: Exclude `data/` and `results/` from Git and Docker contexts (only `data/README.md` is tracked). Never read the dev archive in tests; use generated Parquet fixtures in marked temp dirs.
- **Data semantics**: Present snapshot scores, not historical front-page rankings. Keep user-generated story titles untranslated. Dates and rankings are UTC.
- **UI & MVVM**: Preserve prototype visuals, motion, reduced-motion support, automatic language detection, and direct language toggle. Keep views, viewmodels, and API client separate.
- **Test isolation**: Tests own their temp files and processes and never reuse an existing server. Browser E2E uses `:27065`, integration binds an ephemeral loopback port, and dev stays on `:7065`.
- **Deployment pipeline**: [.github/workflows/pipeline.yml](.github/workflows/pipeline.yml) runs `quality` ([quality-slots.yml](.github/workflows/quality-slots.yml)) first and gates `deploy` (`D1`–`D5` via pinned `nocoo/base-ci` `deploy-docker.yml`) on `main` push or `workflow_dispatch` with `deploy: true` (PRs never deploy).
- **Production boundary**: Confirm host and port availability before changing production (`deploy/compose.yaml`, `127.0.0.1:17065`). Never alter production or GitHub environments without explicit authorization.
- **Fail-closed gates**: Do not bypass hooks. Missing tools, failed checks, empty runs, timeouts, scanner findings, incomplete data, CI errors, or missing deployment evidence must fail the gate—never report as success.

## Quality & Local Gates

Follows `system1-quality`; CI/CD orchestration lives in [.github/workflows/pipeline.yml](.github/workflows/pipeline.yml) and slot definitions + pinned `base-ci` revision live in [.github/workflows/quality-slots.yml](.github/workflows/quality-slots.yml) (`quality / Z1: Gate` required on `main`). Status vocabulary: `enforced`, `planned`, `manual`, `N/A`.

- **Exceptions**: `L2 Runtime` is `N/A` (Node/DuckDB verified in `L3`). `P1 Package` builds the Docker image via BuildKit (`scope=hackernews-on-this-day-web`, shared with CD `D2`) and verifies it via `bun run test:container`, aggregated by `Z1` (`nocoo/base-ci/.github/actions/z1-gate`) on the matching SHA.
- **L1 coverage scope**: `>=90%` statements/functions/lines and `>=85%` branches covers only `src/calendar.ts`, `src/i18n.ts`, `server/api.ts`, and `server/archive.ts`; gate/deployment tests, HTTP entrypoint, UI, and other scripts are outside this denominator.
- **Local hooks**: Install via `bun run hooks:install` (`.githooks/`). Neither hook reads the worktree; requires Bun `1.4.4`, Node `26.13.0`, Gitleaks `8.30.1`, OSV Scanner `>=2.5` (push), and `actionlint` (workflows).
- **Pre-commit** (`60s` timeout): Exports staged Git index to a temp dir, installs frozen deps there, and runs `G1/S1/S2/L1` plus `S3` when `.github/workflows/` changes.
- **Pre-push** (`300s` total): Reads all pushed refs, exports each exact commit to a separate temp dir, scans its `G1` history range, and runs `G2/S1/S2/L1/B1/L3/L4`.

## Resources & Isolation

| Lane | Endpoint / State | Boundary |
| --- | --- | --- |
| Dev | `127.0.0.1:7065` (`https://hntoday.dev.hexly.ai`), local `data/` | Daily local archive; preserve running server |
| Tests | `127.0.0.1:27065` (E2E), ephemeral loopback (L3/Docker), marked temp dirs | Owned synthetic Parquet fixtures & processes; auto-cleaned |
| Prod | Planned `https://hntoday.hexly.ai`, `deploy/compose.yaml` (`127.0.0.1:17065`, `/data:ro`) | Not yet deployed; explicit authorization required before any change |

## Retrospective

Record incident narratives in [Retrospective.md](Retrospective.md); promote recurring project constraints to `Invariants` above and enforceable safeguards to tests or hooks.

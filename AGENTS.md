# Hacker News On This Day

A bilingual Vite/React site with a Node HTTP API and DuckDB reading a separately mounted Hacker News Parquet archive. The application code is MIT; the dataset is separately licensed. Human overview: [README.md](README.md). Historical mistakes: [Retrospective.md](Retrospective.md).

## Invariants

- The root `package.json` is the authoritative version; the site and `/api/live` derive their version from it. Keep `CHANGELOG.md` and release tags synchronized.
- Keep `data/` and `results/` out of Git and Docker build contexts. Only `data/README.md` is tracked. Never use the development archive in tests; generated Parquet fixtures live in marked temporary directories.
- The site presents snapshot scores, not historical front-page rankings. User-generated titles remain untranslated. Dates and ranking are UTC.
- Preserve the prototype's visuals and motion, reduced-motion support, automatic language detection and direct language toggle. Views, viewmodels and API client remain separate.
- Tests use owned temporary files and processes. Browser E2E uses port 27065 and generated fixtures; never reuse an existing server. Integration tests bind an ephemeral loopback port. Daily development stays on 7065.
- Production is not deployed yet. The future public origin is `https://hntoday.hexly.ai`; `deploy/compose.yaml` plans host port 17065 and a read-only archive mount. Confirm the target host and port availability before any deployment.
- Publishing a non-prerelease GitHub Release triggers deployment. The version tag must point to current main, and pinned base-ci must prove the exact main CI run and `quality / Z1: Gate` before building and deploying image digests. A push alone never deploys. Do not publish, deploy, configure GitHub environments or alter production without explicit authorization.

## Commands

Run in the repository root with Bun 1.4.4 and Node 26.13.0. On this machine use the npm mirror in [README.md](README.md). Browser tests require Playwright Chromium or `CHROME_PATH` pointing at an existing Chromium/Chrome executable.

```sh
bun run hooks:install
bun run check
bun run workflow:lint
bun run test:coverage
bun run test:deployment
bun run test:integration
bun run test:browser
BUN_CONFIG_REGISTRY=https://mirrors.tencent.com/npm/ bun run test:container
bun run build
git diff --check
```

The `test:integration` and `test:browser` commands build the application and start isolated production-server processes. The browser suite includes both deterministic mocked UI cases and a real HTTP/Parquet journey. The container smoke builds a unique local image, mounts a synthetic archive read-only, verifies revision and data, and removes its own image, container and fixture.

## Quality Slots

System0 quality definitions come from the `system0-quality` skill; this repo uses native CI with base-ci v2026.15 (`777bbe4f9bacab8a91d8c01974480a6ee23d28e0`). Local hooks are installed with `bun run hooks:install`; the first actual GitHub CI run has not yet been observed.

| Slot | Coverage and stage | Local evidence / limits |
| --- | --- | --- |
| S1 Types | TypeScript; pre-commit, pre-push, CI | `bun run typecheck` |
| S2 Lint | Biome zero warnings and focused/skipped-test guard; pre-commit, pre-push, CI | `bun run lint` |
| S3 Workflow | actionlint and immutable external action SHAs; pre-commit when workflows change, CI | `bun run workflow:lint`; local actionlint 1.7.12 |
| G1 Secrets | Git index / pushed commit range / CI checkout | Gitleaks 8.30.1; staged fake-secret injection tested in an isolated repo |
| G2 Dependencies | `bun.lock`; pre-push and CI | OSV Scanner >=2.5 locally, base-ci pinned scanner in CI |
| B1 Build | Vite client and production server; pre-push and CI | `bun run build` |
| L1 Unit | Calendar, language, API and archive-query coverage, 95% each for statements, branches, functions and lines; pre-commit, pre-push, CI | `bun run test:coverage` reports 100% x4 for **only `src/calendar.ts`, `src/i18n.ts`, `server/api.ts` and `server/archive.ts`**. Gate validation and deployment-verifier tests run without coverage thresholds. The HTTP entrypoint, UI and other scripts are not included in this coverage denominator. |
| L2 Runtime | N/A | No separate platform-binding runtime suite; Node/DuckDB behavior is tested via L3. |
| L3 Integration | Real production HTTP and generated Parquet; pre-push and CI | `bun run test:integration` |
| L4 E2E | Chromium UI journeys, including real production API/Parquet; pre-push and CI | `bun run test:browser` |
| P1 Package | N/A | Private application; no published package. |
| Z1 Gate | Validates all enabled results and their matching SHA; CI | `scripts/quality/validate-slots.ts`, with failure-injection unit tests; not yet observed on GitHub. |

A separate blocking `Container image E2E` CI job builds the Docker image and exercises it with a read-only synthetic archive; Z1 requires its success and matching SHA. Local pre-commit checks an exported Git index in a temporary directory, installs the frozen dependencies there and runs G1/S1/S2/L1 plus S3 for workflow changes (60s hard timeout). Pre-push reads all pushed refs, exports each exact commit to a separate temporary directory, checks the corresponding G1 history range and runs G2/S1/S2/L1/B1/L3/L4 (300s for the entire push). Neither gate reads the worktree as its test source. Local and isolated hook trials on this machine measured roughly 7–21s pre-commit and 23–70s pre-push; CI and remote deployment timings remain unmeasured.

Do not bypass or disable hooks. Missing tools, failed checks, empty test runs and timeouts must fail the relevant gate. Scanner findings, incomplete data, CI errors or missing deployment evidence must not be reported as success.

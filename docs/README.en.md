<h1 align="center">Hacker News On This Day</h1>
<p align="center">A time machine for Hacker News: explore the top 5 highest-scored stories on the same UTC date across the previous 15 years.</p>
<p align="center"><a href="../README.md">简体中文</a></p>

## What It Does

`Hacker News On This Day` is a bilingual (Chinese/English) web application with a Vite/React frontend and a Node HTTP API backed by DuckDB querying a locally mounted [open-index/hacker-news](https://huggingface.co/datasets/open-index/hacker-news) monthly Parquet archive.

It ranks non-deleted, non-dead stories with titles by snapshot `score` descending (breaking ties by `id` ascending), rather than historical front-page rankings. Original story titles remain untranslated. The archive is not committed to Git or bundled into the container image; production deployment has not yet been performed.

## Features

- **Timeline & trend chart**: year scrubber, timeline view, trend chart, light/dark themes, and `prefers-reduced-motion` support.
- **Bilingual UI**: follows browser Chinese or English preference by default, with a persistent manual toggle.
- **Strict data semantics**: shows February 29 only in leap years, flags missing yearly files in the UI, and returns an error instead of simulated data when the archive is unavailable.
- **API endpoints**: `GET /api/day?month=11&day=12` returns per-year rankings; `GET /api/live` reports process liveness, package version, and optional `APP_REVISION`.

## Usage

Place monthly Parquet files under `data/YYYY/YYYY-MM.parquet` (or point `DATA_DIR` to your archive directory), then start either the local dev server or Docker container.

Local development:

```sh
bun install --frozen-lockfile
bun run dev              # start Vite dev server on 127.0.0.1:7065
```

Docker build and run (the image builds without `data/` and mounts it read-only at runtime):

```sh
docker build -t hackernews-on-this-day .
docker run --rm -p 127.0.0.1:7065:7065 \
  -v "$PWD/data:/data:ro" hackernews-on-this-day
```

## Development

Requires Node.js 24+ and Bun (quality gates pin Node `26.13.0` and Bun `1.4.4` in `.mise.toml`). In restricted networks, set `BUN_CONFIG_REGISTRY=https://mirrors.tencent.com/npm/` or pass `--build-arg NPM_REGISTRY=https://mirrors.tencent.com/npm/` to Docker.

```sh
bun run hooks:install    # install local Git hooks from .githooks
bun run check            # typecheck (tsc --noEmit) + Biome lint
bun run workflow:lint    # validate GitHub Actions workflows and pinned SHAs
bun run build            # build client and server bundles into dist/
bun run start            # run production Node server (node dist/server/index.js)
```

## Tests

Tests use generated Parquet fixtures in temp directories and never read the local development archive. Browser tests require Playwright Chromium (`bunx playwright install chromium`) or `CHROME_PATH`.

```sh
bun run test                 # build and run all Vitest suites
bun run test:coverage        # unit coverage (>= 95% on 4 core files)
bun run test:deployment      # release-proof and deployment-verifier tests
bun run test:integration     # build and run isolated server integration tests
bun run test:browser         # build and run Playwright E2E on :27065
bun run test:container       # Docker build and read-only mount smoke test
```

## Stack

- **Frontend**: React 19, TypeScript, Vite (MVVM layers: `src/components/`, `src/viewmodels/`, `src/api/`)
- **Backend & query**: Node.js HTTP API (`server/`), DuckDB (`@duckdb/node-api`)
- **Quality & testing**: Biome, Vitest (`@vitest/coverage-v8`), Playwright, Docker

## Documentation

- [Data Layout](../data/README.md)
- [Project Contract](../AGENTS.md)
- [Changelog](../CHANGELOG.md)
- [Retrospective](../Retrospective.md)

## License

Application code: [MIT](../LICENSE). The Hacker News archive dataset is licensed separately (ODC-By); see [data/README.md](../data/README.md).

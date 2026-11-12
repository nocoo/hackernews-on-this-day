# Hacker News On This Day

A small time machine for Hacker News: explore the five highest-scored stories submitted on the same UTC calendar date in each of the previous 15 years. The interface follows the provided design prototype, with a year scrubber, timeline, trend chart, light and dark themes, and reduced-motion support. The interface follows the browser's Chinese or English language preference by default; the language button switches between them and remembers the selection. Story titles and other archive content remain in their original language.

## Data and interpretation

The website queries the [open-index/hacker-news](https://huggingface.co/datasets/open-index/hacker-news) monthly Parquet archive locally with DuckDB. It selects stories with a title that are not marked deleted or dead, sorts by snapshot `score` descending and `id` ascending, and displays up to five per year. Links lead to the actual Hacker News discussion and, for the lead story, the original source when present.

The dataset does **not** contain the historical front-page ranking. Scores, moderation flags, and comment counts are point-in-time snapshots and can differ from their values on the original day. Data is licensed separately under ODC-By; its authors may hold additional rights. See [data/README.md](data/README.md).

The archive is not committed to Git or embedded in the image. Copy the monthly files into `data/YYYY/YYYY-MM.parquet`, or provide another directory with `DATA_DIR`. Missing yearly files are reported in the interface. An entirely unavailable archive produces an error rather than simulated results. February 29 is shown only for leap years.

## Develop

Development requires Node.js 24+ and Bun. The quality gates use the exact versions in `.mise.toml` (Node 26.13.0 and Bun 1.4.4). On this machine use the approved npm mirror:

```sh
BUN_CONFIG_REGISTRY=https://packagefeedproxy.microsoft.io/npm/ bun install --frozen-lockfile
bun run dev
```

The development server listens on `127.0.0.1:7065`. The local Caddy origin is `https://hntoday.dev.hexly.ai`; the intended public deployment origin is `https://hntoday.hexly.ai`.

```sh
bun run hooks:install
bun run check
bun run workflow:lint
bun run test:coverage
bun run test:deployment
bun run test:integration
bun run test:browser
BUN_CONFIG_REGISTRY=https://packagefeedproxy.microsoft.io/npm/ bun run test:container
bun run build
bun run start
```

The local hooks require Gitleaks 8.30.1, OSV Scanner 2.5+ and actionlint when workflows change. They test isolated snapshots of the Git index or the exact pushed commit, not the development archive. Browser tests require Playwright Chromium (`bunx playwright install chromium`), or an existing Chrome executable supplied as `CHROME_PATH`. They include mocked UI cases and a real journey through the production server with generated Parquet fixtures. For local manual verification, use the downloaded archive.

CI follows System0 quality slots and pins base-ci v2026.15. Unit coverage enforces 95% for statements, branches, functions and lines over `src/calendar.ts`, `src/i18n.ts`, `server/api.ts` and `server/archive.ts`; the HTTP entrypoint, UI and other scripts are not in that denominator. Integration, browser, deployment-verifier and Docker smoke tests cover additional behavior without claiming whole-repository coverage. See [AGENTS.md](AGENTS.md) for the slot map and current evidence.

## Container

The Docker build context excludes `data/` and `results/`. Build independently of the archive, then mount it read-only at runtime:

```sh
docker build -t hackernews-on-this-day .
docker run --rm -p 127.0.0.1:7065:7065 \
  -v "$PWD/data:/data:ro" hackernews-on-this-day
```

Where direct npm registry access is restricted, pass `--build-arg NPM_REGISTRY=https://packagefeedproxy.microsoft.io/npm/`. If that mirror is unreachable inside Docker, `https://mirrors.tencent.com/npm/` is an alternative. `docker compose up --build` uses the same read-only data mount. The application serves its own static assets and API; a reverse proxy can terminate TLS in front of it. No data is needed to build the image.

### Future production deployment

Deployment is prepared but has **not** been performed. Publishing a non-prerelease GitHub Release triggers `.github/workflows/release.yml`. It verifies that the version tag points to current main, finds a successful CI run for that exact revision and uses the pinned base-ci Docker workflow to require `quality / Z1: Gate`, build a GHCR image and deploy its digest. A CI run or push alone does not deploy.

Before an explicitly authorized deployment, choose and verify the host and availability of `127.0.0.1:17065`, install `deploy/compose.yaml` as `/data/hackernews-on-this-day/compose.yaml`, and transfer the archive separately into `/data/hackernews-on-this-day/data/`. Ensure the container's Node user can read the files. The archive is mounted at `/data` read-only and is never part of the image. Configure the `hackernews-on-this-day / production` GitHub environment, its SSH/GHCR and Tailscale federation secrets, and the public reverse proxy separately; none have been configured by this repository.

The deploy workflow verifies the running image digest, OCI revision and read-only mount, then checks the private service and the public `https://hntoday.hexly.ai` origin. The production container joins the existing external `edge` Docker network so the Caddy container can reach `hntoday-app:7065`. The public check requires the expected revision and a non-empty archive without missing years. `APP_REVISION` is populated from the verified image SHA by the production Compose template.

## Architecture

- `src/components/`: presentation, visual effects and interaction.
- `src/viewmodels/`: date selection and archive loading state.
- `src/api/`: browser API client.
- `server/`: HTTP API, validation and DuckDB queries; production also serves the built Vite assets.

`GET /api/day?month=11&day=12` returns the per-year rankings; `GET /api/live` is a process liveness check reporting the component, package version and optional `APP_REVISION`, not an archive-readiness check.

## License

Application code: [MIT](LICENSE). The Hacker News archive and content are licensed separately.

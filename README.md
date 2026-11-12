# Hacker News On This Day

A small time machine for Hacker News: explore the five highest-scored stories submitted on the same UTC calendar date in each of the previous 15 years. The interface follows the provided design prototype, with a year scrubber, timeline, trend chart, light and dark themes, and reduced-motion support. The interface follows the browser's Chinese or English language preference by default; the language selector can override or restore it. Story titles and other archive content remain in their original language.

## Data and interpretation

The website queries the [open-index/hacker-news](https://huggingface.co/datasets/open-index/hacker-news) monthly Parquet archive locally with DuckDB. It selects stories with a title that are not marked deleted or dead, sorts by snapshot `score` descending and `id` ascending, and displays up to five per year. Links lead to the actual Hacker News discussion and, for the lead story, the original source when present.

The dataset does **not** contain the historical front-page ranking. Scores, moderation flags, and comment counts are point-in-time snapshots and can differ from their values on the original day. Data is licensed separately under ODC-By; its authors may hold additional rights. See [data/README.md](data/README.md).

The archive is not committed to Git or embedded in the image. Copy the monthly files into `data/YYYY/YYYY-MM.parquet`, or provide another directory with `DATA_DIR`. Missing yearly files are reported in the interface. An entirely unavailable archive produces an error rather than simulated results. February 29 is shown only for leap years.

## Develop

Requires Node.js 24+ and Bun. On this machine use the approved npm mirror:

```sh
BUN_CONFIG_REGISTRY=https://packagefeedproxy.microsoft.io/npm/ bun install --frozen-lockfile
bun run dev
```

The development server listens on `127.0.0.1:7065`. The local Caddy origin is `https://hntoday.dev.hexly.ai`; the intended public deployment origin is `https://hntoday.hexly.ai`.

```sh
bun run check
bun run test
bun run test:browser
bun run build
bun run start
```

Browser tests require Playwright Chromium (`bunx playwright install chromium`), or an existing Chrome executable supplied as `CHROME_PATH`. They use deterministic mock API responses; server tests exercise actual generated Parquet fixtures. For local manual verification, use the downloaded archive.

## Container

The Docker build context excludes `data/` and `results/`. Build independently of the archive, then mount it read-only at runtime:

```sh
docker build -t hackernews-on-this-day .
docker run --rm -p 127.0.0.1:7065:7065 \
  -v "$PWD/data:/data:ro" hackernews-on-this-day
```

Where direct npm registry access is restricted, pass `--build-arg NPM_REGISTRY=https://packagefeedproxy.microsoft.io/npm/`. `docker compose up --build` uses the same read-only data mount. The application serves its own static assets and API; a reverse proxy can terminate TLS in front of it. No data is needed to build the image.

## Architecture

- `src/components/`: presentation, visual effects and interaction.
- `src/viewmodels/`: date selection and archive loading state.
- `src/api/`: browser API client.
- `server/`: HTTP API, validation and DuckDB queries; production also serves the built Vite assets.

`GET /api/day?month=11&day=12` returns the per-year rankings; `GET /api/live` is a process liveness check, not an archive-readiness check.

## License

Application code: [MIT](LICENSE). The Hacker News archive and content are licensed separately.

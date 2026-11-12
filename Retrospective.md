# Retrospective

## 2026-11-12: Moving the working directory

The project directory was moved while the agent still used its original working directory. Subsequent shell calls failed because that path no longer existed. A temporary symlink restored the session; future moves should update the harness working directory before removing the old path, or keep a temporary bridge until the session ends.

The global instruction path is a symlink. An initial attempt to read rules relative to the symlink failed. Resolve the real path before loading related rules.

## 2026-11-12: Test runner discovery

Adding Playwright specs under `browser/` caused Vitest to discover and execute them as unit tests. Restrict Vitest to `tests/` and run Playwright separately. When introducing a second runner, verify both runners' discovery patterns before adding tests.

## 2026-11-12: Mobile layout with real archive titles

The initial browser test used only short fixture titles and missed a long unbroken real title that widened the mobile page. Allow the mobile grid tracks to shrink and wrap long titles; keep a long-title fixture and a date-change assertion in the browser test.

## 2026-11-12: Revealed content disappeared while scrolling

The reveal observer added an `in` class and then stopped observing, but React replaced that class when the active chapter or chart hover state changed. The content became transparent permanently. Keep reveal state in a separate attribute that React does not overwrite, and test actual opacity after scrolling between chapters and interacting with the chart.

## 2026-11-12: Chinese date formatting

The numeric `Intl.DateTimeFormat` options produced `11/12`, not the original `11月12日`. Use the explicit Chinese date format and test both languages in the actual runtimes before assuming locale formatting.

## 2026-11-12: Narrow navigation with language controls

The mobile overflow check passed even though the new language selector overlapped the date navigation because the page clips horizontal overflow. Test the actual control bounds and inspect narrow-screen layouts in both languages rather than relying on document width alone.

## 2026-11-12: Discovering the deployment reference

The Firefly deployment workflow was assumed to be named `deploy.yml`, but it is `release.yml`; the local base-ci checkout also lacked the current tag. Discover workflow filenames first and verify the tag and its contents from the remote source when the local clone is stale.

## 2026-11-12: Browser fixture cleanup

Playwright force-killed its web server by default, leaving an isolated Parquet fixture behind. Configure graceful shutdown, clean only a marked owned fixture, and check cleanup after both passing and intentionally failing browser runs.

## 2026-11-12: Bun mirror URLs in the lockfile

A dependency installation rewrote lockfile entries to the temporary mirror URL, including a different mirror hostname than the initial normalization expected. Remove machine-specific URLs before committing and verify the entire lockfile has none.

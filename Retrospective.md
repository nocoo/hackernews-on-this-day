# Retrospective

## 2026-11-12: Moving the working directory

The project directory was moved while the agent still used its original working directory. Subsequent shell calls failed because that path no longer existed. A temporary symlink restored the session; future moves should update the harness working directory before removing the old path, or keep a temporary bridge until the session ends.

The global instruction path is a symlink. An initial attempt to read rules relative to the symlink failed. Resolve the real path before loading related rules.

## 2026-11-12: Test runner discovery

Adding Playwright specs under `browser/` caused Vitest to discover and execute them as unit tests. Restrict Vitest to `tests/` and run Playwright separately. When introducing a second runner, verify both runners' discovery patterns before adding tests.

## 2026-11-12: Mobile layout with real archive titles

The initial browser test used only short fixture titles and missed a long unbroken real title that widened the mobile page. Allow the mobile grid tracks to shrink and wrap long titles; keep a long-title fixture and a date-change assertion in the browser test.

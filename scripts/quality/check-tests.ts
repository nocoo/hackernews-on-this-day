import { readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export function hasExcludedTests(source: string): boolean {
  return (
    /\b(?:test|it|describe)(?:\s*\.\s*\w+)*\s*\.\s*(?:only|skip|skipIf|todo|fixme|runIf)\b/.test(source) ||
    /@\s*(?:unittest|pytest)\s*\.\s*(?:skip|skipIf|skipUnless)\b|\bskipTest\s*\(/.test(source)
  );
}

function files(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return files(path);
    return /(?:\.(?:test|spec)\.(?:ts|mjs)|_test\.py)$/.test(path) ? [path] : [];
  });
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const tests = ["tests", "browser", "scripts"].flatMap(files);
  const excluded = tests.filter((path) => hasExcludedTests(readFileSync(path, "utf8")));
  if (!tests.length || excluded.length) {
    console.error(
      excluded.length ? `Focused or skipped tests: ${excluded.join(", ")}` : "No test files found",
    );
    process.exitCode = 1;
  } else console.log(`Checked ${tests.length} test files for focused or skipped tests`);
}

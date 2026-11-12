import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { hasExcludedTests } from "../scripts/quality/check-tests";
import { validActionReference } from "../scripts/quality/check-workflows";
import { validateSlots } from "../scripts/quality/validate-slots";

const sha = "a".repeat(40);
const required = [
  "s1-types",
  "s2-lint",
  "s3-workflow",
  "g1-secrets",
  "g2-dependencies",
  "b1-build",
  "l1-unit",
  "l3-integration",
  "l4-e2e",
];
const absent = ["l2-runtime", "p1-package"];
function results() {
  return Object.fromEntries([
    ...required.map((id) => [id, { result: "success", outputs: { "tested-sha": sha } }]),
    ...absent.map((id) => [id, { result: "skipped" }]),
  ]);
}

describe("test declarations", () => {
  it("rejects focused or skipped tests", () => {
    const dot = ".";
    for (const kind of ["only", "skip", "skipIf", "todo", "fixme", "runIf"]) {
      expect(hasExcludedTests(`test${dot}${kind}("example", () => {})`)).toBe(true);
    }
    expect(hasExcludedTests("test('example', () => {})")).toBe(false);
  });
});

describe("workflow references", () => {
  it("requires immutable external action revisions", () => {
    expect(validActionReference("./.github/workflows/quality-slots.yml")).toBe(true);
    expect(validActionReference(`actions/checkout@${sha}`)).toBe(true);
    expect(validActionReference("actions/checkout@v7")).toBe(false);
    expect(validActionReference("actions/checkout@abc123")).toBe(false);
  });
});

describe("quality gate", () => {
  it("requires every implemented slot to pass on exactly the expected SHA", () => {
    expect(validateSlots(results(), sha)).toEqual([]);
    for (const id of required) {
      const failed = results();
      failed[id] = { result: "failure" };
      expect(validateSlots(failed, sha)).not.toEqual([]);
      const skipped = results();
      skipped[id] = { result: "skipped" };
      expect(validateSlots(skipped, sha)).not.toEqual([]);
      const missing = results();
      delete missing[id];
      expect(validateSlots(missing, sha)).not.toEqual([]);
      const noSha = results();
      noSha[id] = { result: "success" };
      expect(validateSlots(noSha, sha)).not.toEqual([]);
      const mismatch = results();
      mismatch[id] = { result: "success", outputs: { "tested-sha": "b".repeat(40) } };
      expect(validateSlots(mismatch, sha)).not.toEqual([]);
    }
  });

  it("rejects enabled or missing N/A slots, unexpected slots and invalid SHAs", () => {
    for (const id of absent) {
      const enabled = results();
      enabled[id] = { result: "success", outputs: { "tested-sha": sha } };
      expect(validateSlots(enabled, sha)).not.toEqual([]);
      const missing = results();
      delete missing[id];
      expect(validateSlots(missing, sha)).not.toEqual([]);
    }
    expect(validateSlots({ ...results(), unexpected: { result: "success" } }, sha)).not.toEqual([]);
    expect(validateSlots(results(), "invalid")).not.toEqual([]);
  });

  it("fails closed on malformed input and emits the SHA only after success", async () => {
    const directory = await mkdtemp(join(tmpdir(), "hntoday-gate-"));
    try {
      const output = join(directory, "output");
      const run = (needs: string) =>
        spawnSync("node", ["scripts/quality/validate-slots.ts"], {
          env: { ...process.env, EXPECTED_SHA: sha, NEEDS_JSON: needs, GITHUB_OUTPUT: output },
          encoding: "utf8",
        });
      expect(run("not-json").status).not.toBe(0);
      expect(run(JSON.stringify(results())).status).toBe(0);
      expect(await readFile(output, "utf8")).toBe(`tested-sha=${sha}\n`);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
});

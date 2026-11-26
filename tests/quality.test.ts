import { describe, expect, it } from "vitest";
import { hasExcludedTests } from "../scripts/quality/check-tests";
import { validActionReference } from "../scripts/quality/check-workflows";

const sha = "a".repeat(40);

describe("test declarations", () => {
  it("rejects focused or skipped tests", () => {
    const dot = ".";
    for (const kind of ["only", "skip", "skipIf", "todo", "fixme", "runIf"]) {
      expect(hasExcludedTests(`test${dot}${kind}("example", () => {})`)).toBe(true);
    }
    expect(hasExcludedTests(`@unittest${dot}skip('fixture')`)).toBe(true);
    expect(hasExcludedTests(`self${dot}${"skip"}Test('fixture')`)).toBe(true);
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

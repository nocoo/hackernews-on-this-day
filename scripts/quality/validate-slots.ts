import { appendFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const implemented = [
  "s1-types",
  "s2-lint",
  "s3-workflow",
  "g1-secrets",
  "g2-dependencies",
  "b1-build",
  "l1-unit",
  "l3-integration",
  "l4-e2e",
  "container-image-e2e",
] as const;
const notApplicable = ["l2-runtime", "p1-package"] as const;

type Result = { result?: string; outputs?: { "tested-sha"?: string } };

export function validateSlots(needs: Record<string, Result>, expected: string): string[] {
  const errors: string[] = [];
  if (!/^[a-f0-9]{40}$/.test(expected)) errors.push("Invalid expected SHA");
  const known = new Set<string>([...implemented, ...notApplicable]);
  for (const id of Object.keys(needs)) if (!known.has(id)) errors.push(`Unexpected slot: ${id}`);
  for (const id of implemented) {
    const result = needs[id];
    if (result?.result !== "success") errors.push(`${id} did not succeed`);
    else if (result.outputs?.["tested-sha"] !== expected) errors.push(`${id} tested a different SHA`);
  }
  for (const id of notApplicable) {
    if (needs[id]?.result !== "skipped") errors.push(`${id} must be skipped`);
  }
  return errors;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const needs: Record<string, Result> = JSON.parse(process.env.NEEDS_JSON ?? "");
    if (!needs || typeof needs !== "object" || Array.isArray(needs)) throw new Error("Invalid needs");
    const expected = process.env.EXPECTED_SHA ?? "";
    const errors = validateSlots(needs, expected);
    if (errors.length) throw new Error(errors.join("; "));
    if (!process.env.GITHUB_OUTPUT) throw new Error("Missing GITHUB_OUTPUT");
    appendFileSync(process.env.GITHUB_OUTPUT, `tested-sha=${expected}\n`);
    console.log(`All required slots passed for ${expected}; L2 Runtime and P1 Package are not applicable.`);
  } catch (error) {
    console.error(error instanceof Error ? error.message : "Slot validation failed");
    process.exitCode = 1;
  }
}

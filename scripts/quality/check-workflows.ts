import { spawnSync } from "node:child_process";
import { readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export function validActionReference(reference: string): boolean {
  return reference.startsWith("./") || /^[^@\s]+@[a-f0-9]{40}$/.test(reference);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const files = readdirSync(".github/workflows")
    .filter((name) => /\.ya?ml$/.test(name))
    .map((name) => join(".github/workflows", name));
  if (!files.length) throw new Error("No GitHub workflows found");
  for (const file of files) {
    const source = readFileSync(file, "utf8");
    for (const match of source.matchAll(/^\s*(?:-\s*)?uses:\s*([^\s#]+)/gm)) {
      if (!validActionReference(match[1])) {
        throw new Error(`${file}: action reference must use a full commit SHA: ${match[1]}`);
      }
    }
  }
  const result = spawnSync("actionlint", ["-shellcheck=", "-pyflakes=", ...files], { stdio: "inherit" });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exitCode = result.status ?? 1;
  else console.log(`Validated ${files.length} workflows and immutable action references`);
}

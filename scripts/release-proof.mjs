import { execFileSync } from "node:child_process";
import { appendFileSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

export async function resolveReleaseProof({
  tag,
  version,
  commit,
  repository,
  token,
  api = "https://api.github.com",
  fetchImpl = fetch,
}) {
  if (!/^v\d+\.\d+\.\d+$/.test(tag) || tag !== `v${version}`)
    throw new Error("Release tag does not match package version");
  if (!/^[a-f0-9]{40}$/.test(commit)) throw new Error("Invalid release commit");
  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repository)) throw new Error("Invalid repository");
  if (!token) throw new Error("Missing GitHub token");
  const request = async (path) => {
    const response = await fetchImpl(`${api}/repos/${repository}${path}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
      },
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) throw new Error(`GitHub request failed (${response.status})`);
    return response.json();
  };
  const main = await request("/commits/main");
  if (main?.sha !== commit) throw new Error("Checked-out revision is not the current main commit");
  const reference = await request(`/git/ref/tags/${encodeURIComponent(tag)}`);
  if (reference?.ref !== `refs/tags/${tag}` || !/^[a-f0-9]{40}$/.test(reference.object?.sha ?? ""))
    throw new Error("Invalid release tag reference");
  let tagged = reference.object;
  if (tagged.type === "tag") {
    const annotated = await request(`/git/tags/${tagged.sha}`);
    tagged = annotated?.object;
  }
  if (tagged?.type !== "commit" || tagged.sha !== commit)
    throw new Error("Release tag does not point to current main");
  for (let page = 1; page <= 100; page++) {
    const query = new URLSearchParams({
      event: "push",
      status: "success",
      head_sha: commit,
      per_page: "100",
      page: String(page),
    });
    const result = await request(`/actions/workflows/ci.yml/runs?${query}`);
    if (!Array.isArray(result?.workflow_runs)) throw new Error("Invalid CI runs response");
    const run = result.workflow_runs.find(
      (entry) =>
        entry?.head_sha === commit &&
        entry.head_branch === "main" &&
        entry.event === "push" &&
        entry.status === "completed" &&
        entry.conclusion === "success" &&
        entry.repository?.full_name === repository &&
        entry.head_repository?.full_name === repository &&
        Number.isSafeInteger(entry.id) &&
        entry.id > 0,
    );
    if (run) return String(run.id);
    if (result.workflow_runs.length < 100) break;
  }
  throw new Error("No successful main push CI run for the release commit");
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const tag = process.env.RELEASE_TAG ?? "";
    const version = JSON.parse(readFileSync("package.json", "utf8")).version;
    const commit = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
    const runId = await resolveReleaseProof({
      tag,
      version,
      commit,
      repository: process.env.GITHUB_REPOSITORY ?? "",
      token: process.env.GITHUB_TOKEN ?? "",
      api: process.env.GITHUB_API_URL,
    });
    if (!process.env.GITHUB_OUTPUT) throw new Error("Missing GITHUB_OUTPUT");
    appendFileSync(process.env.GITHUB_OUTPUT, `ci-run-id=${runId}\n`);
    console.log(`Release ${tag} matches current main ${commit} and CI run ${runId}`);
  } catch (error) {
    console.error(error instanceof Error ? error.message : "Release proof failed");
    process.exitCode = 1;
  }
}

import assert from "node:assert/strict";
import { test } from "node:test";
import { resolveReleaseProof } from "./release-proof.mjs";

const sha = "a".repeat(40);
const repository = "nocoo/hackernews-on-this-day";
const run = {
  id: 12345,
  head_sha: sha,
  head_branch: "main",
  event: "push",
  status: "completed",
  conclusion: "success",
  repository: { full_name: repository },
  head_repository: { full_name: repository },
};
const options = { tag: "v0.2.0", version: "0.2.0", commit: sha, repository, token: "fixture" };
const response = (value, status = 200) => new Response(JSON.stringify(value), { status });

function fakeFetch({ main = sha, tagged = sha, annotated = false, runs = [run], status = 200 } = {}) {
  return async (url) => {
    if (url.endsWith("/commits/main")) return response({ sha: main }, status);
    if (url.includes("/git/ref/tags/"))
      return response(
        {
          ref: `refs/tags/${options.tag}`,
          object: { type: annotated ? "tag" : "commit", sha: annotated ? "d".repeat(40) : tagged },
        },
        status,
      );
    if (url.includes("/git/tags/")) return response({ object: { type: "commit", sha: tagged } }, status);
    return response({ workflow_runs: runs }, status);
  };
}

test("release proof accepts only the matching main version and successful push run", async () => {
  assert.equal(await resolveReleaseProof({ ...options, fetchImpl: fakeFetch() }), "12345");
  assert.equal(await resolveReleaseProof({ ...options, fetchImpl: fakeFetch({ annotated: true }) }), "12345");
  await assert.rejects(
    resolveReleaseProof({ ...options, fetchImpl: fakeFetch({ tagged: "b".repeat(40) }) }),
    /tag does not point/,
  );
  await assert.rejects(
    resolveReleaseProof({ ...options, fetchImpl: fakeFetch({ tagged: "b".repeat(40), annotated: true }) }),
    /tag does not point/,
  );
  await assert.rejects(resolveReleaseProof({ ...options, tag: "v0.2.1", fetchImpl: fakeFetch() }), /version/);
  await assert.rejects(resolveReleaseProof({ ...options, commit: "bad", fetchImpl: fakeFetch() }), /commit/);
  await assert.rejects(
    resolveReleaseProof({ ...options, repository: "bad", fetchImpl: fakeFetch() }),
    /repository/,
  );
  await assert.rejects(resolveReleaseProof({ ...options, token: "", fetchImpl: fakeFetch() }), /token/);
  await assert.rejects(
    resolveReleaseProof({ ...options, fetchImpl: fakeFetch({ main: "b".repeat(40) }) }),
    /current main/,
  );
  await assert.rejects(
    resolveReleaseProof({ ...options, fetchImpl: fakeFetch({ status: 403 }) }),
    /GitHub request failed/,
  );
  for (const change of [
    { head_sha: "b".repeat(40) },
    { head_branch: "other" },
    { event: "pull_request" },
    { status: "in_progress" },
    { conclusion: "failure" },
    { repository: { full_name: "other/repo" } },
    { head_repository: { full_name: "other/repo" } },
    { id: 0 },
  ]) {
    await assert.rejects(
      resolveReleaseProof({ ...options, fetchImpl: fakeFetch({ runs: [{ ...run, ...change }] }) }),
      /No successful/,
    );
  }
});

test("release proof paginates exact-SHA runs", async () => {
  const fetchImpl = async (url) => {
    if (url.endsWith("/commits/main")) return response({ sha });
    if (url.includes("/git/ref/tags/"))
      return response({ ref: `refs/tags/${options.tag}`, object: { type: "commit", sha } });
    const page = new URL(url).searchParams.get("page");
    return response({
      workflow_runs:
        page === "1" ? Array.from({ length: 100 }, () => ({ ...run, conclusion: "failure" })) : [run],
    });
  };
  assert.equal(await resolveReleaseProof({ ...options, fetchImpl }), "12345");
});

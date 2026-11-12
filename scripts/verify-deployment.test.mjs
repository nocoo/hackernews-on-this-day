import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { validateManifest, verifyDeployment } from "./verify-deployment.mjs";

const version = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")).version;
const sha = "a".repeat(40);
const digest = `sha256:${"b".repeat(64)}`;
const release = { image: "ghcr.io/nocoo/hackernews-on-this-day", service: "web", sourceSha: sha, digest };
const manifest = JSON.stringify([release]);
const json = (value) =>
  new Response(JSON.stringify(value), {
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });

function fakeFetch({
  revision = sha,
  liveVersion = version,
  missingYears = [],
  month = 11,
  years = [{ year: 2025, stories: [{ id: 1, title: "Synthetic story" }] }],
} = {}) {
  return async (url) => {
    if (url.endsWith("/api/live"))
      return json({ status: "ok", component: "hntoday", version: liveVersion, revision });
    if (url.includes("/api/day?")) return json({ month, day: 12, years, missingYears });
    return new Response("<title>Hacker News</title>", { headers: { "content-type": "text/html" } });
  };
}

test("manifest requires the exact source revision and image digest", () => {
  assert.deepEqual(validateManifest(sha, manifest), release);
  assert.throws(() => validateManifest("invalid", manifest));
  assert.throws(() => validateManifest(sha, "invalid"));
  assert.throws(() => validateManifest(sha, "[]"));
  for (const change of [
    { service: "other" },
    { image: "ghcr.io/nocoo/other" },
    { sourceSha: "c".repeat(40) },
    { digest: "latest" },
  ]) {
    assert.throws(() => validateManifest(sha, JSON.stringify([{ ...release, ...change }])));
  }
});

test("public verification accepts only matching revision and available archive", async () => {
  const options = { sourceSha: sha, manifest, now: new Date("2026-11-12T12:00:00Z"), sleep: async () => {} };
  assert.match(await verifyDeployment({ ...options, fetchImpl: fakeFetch() }), /is healthy/);
  await assert.rejects(
    verifyDeployment({ ...options, fetchImpl: fakeFetch({ revision: "c".repeat(40) }) }),
    /revision/,
  );
  await assert.rejects(
    verifyDeployment({ ...options, fetchImpl: fakeFetch({ liveVersion: "0.0.0" }) }),
    /revision/,
  );
  await assert.rejects(
    verifyDeployment({ ...options, fetchImpl: fakeFetch({ missingYears: [2025] }) }),
    /incomplete/,
  );
  await assert.rejects(verifyDeployment({ ...options, fetchImpl: fakeFetch({ month: 10 }) }), /incomplete/);
  await assert.rejects(
    verifyDeployment({ ...options, fetchImpl: fakeFetch({ years: [{ year: 2025, stories: [] }] }) }),
    /incomplete/,
  );
  await assert.rejects(
    verifyDeployment({
      ...options,
      fetchImpl: async () => {
        throw new Error("offline");
      },
    }),
    /offline/,
  );
});

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createArchiveFixture } from "./fixtures/archive";
import { startFixtureServer } from "./fixtures/server";

let archive: Awaited<ReturnType<typeof createArchiveFixture>>;
let server: Awaited<ReturnType<typeof startFixtureServer>>;

beforeAll(async () => {
  archive = await createArchiveFixture();
  try {
    server = await startFixtureServer(archive.directory);
  } catch (error) {
    await archive.cleanup();
    throw error;
  }
});
afterAll(async () => {
  if (server) await server.stop();
  if (archive) await archive.cleanup();
});

describe("production server with an isolated Parquet archive", () => {
  it("serves the built page and its assets", async () => {
    const response = await fetch(`${server.url}/`);
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/html");
    const html = await response.text();
    const asset = /src="([^"]+\.js)"/.exec(html)?.[1];
    expect(asset).toBeTruthy();
    expect((await fetch(`${server.url}${asset}`)).status).toBe(200);
    expect((await fetch(`${server.url}/`, { method: "HEAD" })).status).toBe(200);
    expect((await fetch(`${server.url}/data/2025/2025-11.parquet`)).status).toBe(404);
  });

  it("queries real Parquet over HTTP and ranks only stories", async () => {
    const live = await fetch(`${server.url}/api/live`);
    expect(await live.json()).toEqual({ status: "ok" });
    const response = await fetch(`${server.url}/api/day?month=11&day=12`);
    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      years: Array<{ year: number; stories: Array<{ id: number; title: string; score: number }> }>;
      missingYears: number[];
    };
    expect(body.years).toHaveLength(15);
    expect(body.missingYears).toEqual([]);
    expect(body.years[0].year).toBe(archive.currentYear - 1);
    expect(body.years[0].stories).toHaveLength(1);
    expect(body.years[0].stories[0]).toMatchObject({
      id: (archive.currentYear - 1) * 100 + 1,
      title: `Synthetic story ${archive.currentYear - 1}`,
      score: 500,
    });
    const previous = await fetch(`${server.url}/api/day?month=11&day=11`);
    expect((await previous.json()).years[0].stories[0].title).toBe(`Previous day ${archive.currentYear - 1}`);
  });

  it("rejects malformed, unsupported and unavailable requests", async () => {
    expect((await fetch(`${server.url}/api/day?month=2&day=30`)).status).toBe(400);
    expect((await fetch(`${server.url}/api/day?month=bogus&day=1`)).status).toBe(400);
    expect((await fetch(`${server.url}/api/day?month=2&day=1`)).status).toBe(503);
    expect((await fetch(`${server.url}/api/unknown`)).status).toBe(404);
    expect((await fetch(`${server.url}/api/live`, { method: "POST" })).status).toBe(405);
    expect((await fetch(`${server.url}/`, { method: "POST" })).status).toBe(405);
  });
});

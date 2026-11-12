import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DuckDBConnection } from "@duckdb/node-api";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { handleApi } from "../server/api";
import { DataUnavailableError, getDayArchive } from "../server/archive";

const currentYear = new Date().getUTCFullYear();
let dir: string;
beforeAll(async () => {
  dir = await mkdtemp(join(tmpdir(), "hn-archive-"));
  const db = await DuckDBConnection.create();
  try {
    for (const year of [currentYear - 2, currentYear - 1]) {
      await mkdir(join(dir, String(year)));
      const path = join(dir, String(year), `${year}-11.parquet`).replaceAll("'", "''");
      await db.run(`COPY (
        SELECT CAST(i AS UINTEGER) AS id, 1::TINYINT AS type, 0::UTINYINT AS deleted,
          0::UTINYINT AS dead, 'Story ' || i AS title, 'author' AS "by", CAST(i AS INTEGER) AS score,
          1::INTEGER AS descendants, 'https://example.com' AS url,
          TIMESTAMPTZ '${year}-11-12 12:00:00+00' AS time
        FROM range(1, 8) r(i)
        UNION ALL
        SELECT 8::UINTEGER, 2::TINYINT, 0::UTINYINT, 0::UTINYINT, 'Comment', 'author', 999, 0, '', TIMESTAMPTZ '${year}-11-12 12:00:00+00'
        UNION ALL
        SELECT 9::UINTEGER, 1::TINYINT, 1::UTINYINT, 0::UTINYINT, 'Deleted', 'author', 999, 0, '', TIMESTAMPTZ '${year}-11-12 12:00:00+00'
        UNION ALL
        SELECT 10::UINTEGER, 1::TINYINT, 0::UTINYINT, 0::UTINYINT, 'Tie', 'author', 7, 0, '', TIMESTAMPTZ '${year}-11-12 23:59:59+00'
        UNION ALL
        SELECT 11::UINTEGER, 1::TINYINT, 0::UTINYINT, 0::UTINYINT, 'Next day', 'author', 999, 0, '', TIMESTAMPTZ '${year}-11-13 00:00:00+00'
        UNION ALL
        SELECT 12::UINTEGER, 1::TINYINT, 0::UTINYINT, 0::UTINYINT, 'Sparse', NULL::VARCHAR, 8, NULL::INTEGER, NULL::VARCHAR, TIMESTAMPTZ '${year}-11-12 00:00:00+00'
      ) TO '${path}' (FORMAT PARQUET)`);
    }
  } finally {
    db.closeSync();
  }
});
afterAll(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe("archive", () => {
  it("selects and ranks the five real stories per year and reports missing files", async () => {
    const result = await getDayArchive(11, 12, dir, currentYear);
    expect(result.years.map((year) => year.year)).toEqual([currentYear - 1, currentYear - 2]);
    expect(result.years[0].stories.map((story) => story.id)).toEqual([12, 7, 10, 6, 5]);
    expect(result.years[0].stories[0]).toMatchObject({ title: "Sparse", author: "", comments: 0, url: "" });
    expect(result.missingYears).toHaveLength(13);
  });
  it("distinguishes invalid dates from unavailable data", async () => {
    await expect(getDayArchive(2, 30, dir, currentYear)).rejects.toThrow(RangeError);
    await expect(getDayArchive(2, 29, dir, currentYear)).rejects.toThrow(DataUnavailableError);
    await expect(
      handleApi({} as Parameters<typeof handleApi>[0], {} as Parameters<typeof handleApi>[1]),
    ).resolves.toBe(false);
  });
  it("validates HTTP input and serves the archive independently of Vite", async () => {
    const previous = process.env.DATA_DIR;
    const previousRevision = process.env.APP_REVISION;
    process.env.DATA_DIR = dir;
    const server = createServer((req, res) => {
      void handleApi(req, res).then((handled) => {
        if (!handled) res.writeHead(404).end();
      });
    });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("Missing test port");
    const base = `http://127.0.0.1:${address.port}`;
    try {
      expect((await fetch(`${base}/api/live`)).status).toBe(200);
      process.env.APP_REVISION = "a".repeat(40);
      expect((await (await fetch(`${base}/api/live`)).json()).revision).toBe("a".repeat(40));
      expect((await fetch(`${base}/`)).status).toBe(404);
      expect((await fetch(`${base}/api/unknown`)).status).toBe(404);
      expect((await fetch(`${base}/api/day?month=11`)).status).toBe(400);
      expect((await fetch(`${base}/api/day?day=1`)).status).toBe(400);
      expect((await fetch(`${base}/api/day?month=bad&day=1`)).status).toBe(400);
      expect((await fetch(`${base}/api/day?month=2&day=1`)).status).toBe(503);
      delete process.env.DATA_DIR;
      expect((await fetch(`${base}/api/day?month=2&day=30`)).status).toBe(400);
      process.env.DATA_DIR = dir;
      expect((await fetch(`${base}/api/day?month=11&day=12`, { method: "POST" })).status).toBe(405);
      const response = await fetch(`${base}/api/day?month=11&day=12`);
      expect(response.status).toBe(200);
      const body = (await response.json()) as {
        years: Array<{ year: number; stories: Array<{ id: number }> }>;
      };
      expect(body.years[0].year).toBe(currentYear - 1);
      expect(body.years[0].stories[0].id).toBe(12);
    } finally {
      await new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      );
      if (previous === undefined) delete process.env.DATA_DIR;
      else process.env.DATA_DIR = previous;
      if (previousRevision === undefined) delete process.env.APP_REVISION;
      else process.env.APP_REVISION = previousRevision;
    }
  });
});

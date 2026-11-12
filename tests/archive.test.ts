import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DuckDBConnection } from "@duckdb/node-api";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { handleApi } from "../server/api";
import { DataUnavailableError, getDayArchive } from "../server/archive";
import { calendarYear, dateLabel, dayOfYear, shiftDay, validDay } from "../src/calendar";
import { browserLanguage } from "../src/i18n";

let dir: string;
beforeAll(async () => {
  dir = await mkdtemp(join(tmpdir(), "hn-archive-"));
  const db = await DuckDBConnection.create();
  try {
    for (const year of [2024, 2025]) {
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
      ) TO '${path}' (FORMAT PARQUET)`);
    }
  } finally {
    db.closeSync();
  }
});
afterAll(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe("calendar", () => {
  it("validates and moves through leap day and year boundaries", () => {
    expect(validDay(2, 29)).toBe(true);
    expect(validDay(2, 30)).toBe(false);
    expect(validDay(13, 1)).toBe(false);
    expect(shiftDay({ month: 2, day: 28 }, 1)).toEqual({ month: 2, day: 29 });
    expect(shiftDay({ month: 1, day: 1 }, -1)).toEqual({ month: 12, day: 31 });
    expect(dateLabel({ month: 11, day: 12 }, "zh")).toBe("11月12日");
    expect(dateLabel({ month: 11, day: 12 }, "en")).toBe("Nov 12");
    expect(dayOfYear({ month: 11, day: 12 }, 2026)).toBe(316);
    expect(calendarYear({ month: 2, day: 29 }, 2026)).toBe(2024);
  });
});

describe("language detection", () => {
  it("uses the first supported browser language and falls back to English", () => {
    expect(browserLanguage(["zh-Hant", "en-US"])).toBe("zh");
    expect(browserLanguage(["fr-FR", "en-US", "zh-CN"])).toBe("en");
    expect(browserLanguage(["fr-FR", "zh-CN"])).toBe("zh");
    expect(browserLanguage([])).toBe("en");
  });
});

describe("archive", () => {
  it("selects and ranks the five real stories per year and reports missing files", async () => {
    const result = await getDayArchive(11, 12, dir, 2026);
    expect(result.years.map((year) => year.year)).toEqual([2025, 2024]);
    expect(result.years[0].stories.map((story) => story.id)).toEqual([7, 10, 6, 5, 4]);
    expect(result.years[0].stories[0].title).toBe("Story 7");
    expect(result.missingYears).toHaveLength(13);
  });
  it("distinguishes invalid dates from unavailable data", async () => {
    await expect(getDayArchive(2, 30, dir, 2026)).rejects.toThrow(RangeError);
    await expect(getDayArchive(2, 29, dir, 2026)).rejects.toThrow(DataUnavailableError);
  });
  it("validates HTTP input and serves the archive independently of Vite", async () => {
    const previous = process.env.DATA_DIR;
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
      expect((await fetch(`${base}/api/day?month=2&day=30`)).status).toBe(400);
      expect((await fetch(`${base}/api/day?month=11&day=12`, { method: "POST" })).status).toBe(405);
      const response = await fetch(`${base}/api/day?month=11&day=12`);
      expect(response.status).toBe(200);
      const body = (await response.json()) as {
        years: Array<{ year: number; stories: Array<{ id: number }> }>;
      };
      expect(body.years[0].year).toBe(2025);
      expect(body.years[0].stories[0].id).toBe(7);
    } finally {
      await new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      );
      if (previous === undefined) delete process.env.DATA_DIR;
      else process.env.DATA_DIR = previous;
    }
  });
});

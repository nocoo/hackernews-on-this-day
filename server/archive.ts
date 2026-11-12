import { access } from "node:fs/promises";
import { join, resolve } from "node:path";
import { DuckDBInstance, listValue } from "@duckdb/node-api";
import { validDay } from "../src/calendar.ts";
import type { DayArchive, Story } from "../src/model.ts";

const instance = DuckDBInstance.create(":memory:");

export class DataUnavailableError extends Error {}

export async function getDayArchive(
  month: number,
  day: number,
  dataDirectory: string,
  currentYear = new Date().getUTCFullYear(),
): Promise<DayArchive> {
  if (!validDay(month, day)) throw new RangeError("Invalid calendar day");
  const dir = resolve(dataDirectory);
  const files: string[] = [];
  const missingYears: number[] = [];
  for (let year = currentYear - 15; year < currentYear; year++) {
    if (new Date(Date.UTC(year, month - 1, day)).getUTCMonth() !== month - 1) continue;
    const path = join(dir, String(year), `${year}-${String(month).padStart(2, "0")}.parquet`);
    try {
      await access(path);
      files.push(path);
    } catch {
      missingYears.push(year);
    }
  }
  if (!files.length) throw new DataUnavailableError("No archive files are available for this date");
  const connection = await (await instance).connect();
  try {
    await connection.run("SET TimeZone = 'UTC'");
    const result = await connection.runAndReadAll(
      `WITH ranked AS (
        SELECT CAST(year(time) AS INTEGER) AS year, id, title, "by" AS author, score,
          descendants AS comments, url,
          row_number() OVER (PARTITION BY year(time) ORDER BY score DESC, id ASC) AS rank
        FROM read_parquet($files)
        WHERE type = 1 AND deleted = 0 AND dead = 0 AND title != '' AND score IS NOT NULL
          AND month(time) = $month AND day(time) = $day
      )
      SELECT year, id, title, author, score, comments, url
      FROM ranked WHERE rank <= 5 ORDER BY year DESC, rank`,
      { files: listValue(files), month, day },
    );
    const years: DayArchive["years"] = [];
    for (const row of result.getRowObjectsJS()) {
      const year = Number(row.year);
      if (years.at(-1)?.year !== year) years.push({ year, stories: [] });
      const story: Story = {
        id: Number(row.id),
        title: String(row.title),
        author: row.author == null ? "" : String(row.author),
        score: Number(row.score),
        comments: row.comments == null ? 0 : Number(row.comments),
        url: row.url == null ? "" : String(row.url),
      };
      years.at(-1)?.stories.push(story);
    }
    return { month, day, years, missingYears };
  } finally {
    connection.closeSync();
  }
}

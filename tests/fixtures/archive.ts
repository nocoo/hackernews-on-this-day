import { randomUUID } from "node:crypto";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DuckDBConnection } from "@duckdb/node-api";

export async function createArchiveFixture() {
  const directory = await mkdtemp(join(tmpdir(), "hntoday-fixture-"));
  const marker = randomUUID();
  const markerFile = join(directory, ".hntoday-fixture");
  await writeFile(markerFile, marker);
  const cleanup = async () => {
    if ((await readFile(markerFile, "utf8")) !== marker) throw new Error("Fixture marker mismatch");
    await rm(directory, { recursive: true });
  };
  try {
    const db = await DuckDBConnection.create();
    try {
      const currentYear = new Date().getUTCFullYear();
      for (let year = currentYear - 15; year < currentYear; year++) {
        await mkdir(join(directory, String(year)));
        const path = join(directory, String(year), `${year}-11.parquet`).replaceAll("'", "''");
        await db.run(`COPY (
          SELECT ${year * 100 + 1}::UINTEGER AS id, 1::TINYINT AS type, 0::UTINYINT AS deleted,
            0::UTINYINT AS dead, 'Synthetic story ${year}' AS title, 'fixture-author' AS "by", 500::INTEGER AS score,
            3::INTEGER AS descendants, 'https://example.test/story' AS url,
            TIMESTAMPTZ '${year}-11-12 12:00:00+00' AS time
          UNION ALL
          SELECT ${year * 100 + 2}::UINTEGER, 1::TINYINT, 0::UTINYINT, 0::UTINYINT, 'Previous day ${year}',
            'fixture-author', 300::INTEGER, 1::INTEGER, '', TIMESTAMPTZ '${year}-11-11 12:00:00+00'
          UNION ALL
          SELECT ${year * 100 + 3}::UINTEGER, 2::TINYINT, 0::UTINYINT, 0::UTINYINT, 'Excluded comment',
            'fixture-author', 999::INTEGER, 0::INTEGER, '', TIMESTAMPTZ '${year}-11-12 13:00:00+00'
        ) TO '${path}' (FORMAT PARQUET)`);
      }
      return { directory, currentYear, cleanup };
    } finally {
      db.closeSync();
    }
  } catch (error) {
    await cleanup();
    throw error;
  }
}

import type { IncomingMessage, ServerResponse } from "node:http";
import { resolve } from "node:path";
import { getDayArchive } from "./archive.ts";

function json(res: ServerResponse, status: number, body: unknown) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
  res.end(JSON.stringify(body));
}

export async function handleApi(req: IncomingMessage, res: ServerResponse): Promise<boolean> {
  const url = new URL(req.url ?? "/", "http://localhost");
  if (!url.pathname.startsWith("/api/")) return false;
  if (req.method !== "GET") {
    json(res, 405, { error: "Method not allowed" });
    return true;
  }
  if (url.pathname === "/api/live") {
    json(res, 200, { status: "ok" });
    return true;
  }
  if (url.pathname !== "/api/day") {
    json(res, 404, { error: "Not found" });
    return true;
  }
  const monthText = url.searchParams.get("month") ?? "";
  const dayText = url.searchParams.get("day") ?? "";
  if (!/^\d{1,2}$/.test(monthText) || !/^\d{1,2}$/.test(dayText)) {
    json(res, 400, { error: "Invalid calendar day" });
    return true;
  }
  try {
    const data = await getDayArchive(
      Number(monthText),
      Number(dayText),
      resolve(process.env.DATA_DIR ?? "data"),
    );
    json(res, 200, data);
  } catch (error) {
    if (error instanceof RangeError) json(res, 400, { error: error.message });
    else {
      console.error("Archive query failed:", error);
      json(res, 503, { error: "Archive data is unavailable" });
    }
  }
  return true;
}

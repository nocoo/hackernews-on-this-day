import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { createServer } from "node:http";
import { dirname, extname, join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { handleApi } from "./api";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const types: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
};

const server = createServer(async (req, res) => {
  try {
    if (await handleApi(req, res)) return;
    if (req.method !== "GET" && req.method !== "HEAD") {
      res.writeHead(405).end();
      return;
    }
    const path = decodeURIComponent(new URL(req.url ?? "/", "http://localhost").pathname);
    let file = resolve(root, `.${path}`);
    if (file !== root && !file.startsWith(`${root}${sep}`)) {
      res.writeHead(403).end();
      return;
    }
    if (file === root) file = join(root, "index.html");
    const info = await stat(file).catch(() => null);
    if (!info?.isFile()) {
      res.writeHead(404).end();
      return;
    }
    res.writeHead(200, { "Content-Type": types[extname(file)] ?? "application/octet-stream" });
    if (req.method === "HEAD") res.end();
    else
      createReadStream(file)
        .on("error", () => res.destroy())
        .pipe(res);
  } catch (error) {
    console.error("Request failed:", error);
    if (!res.headersSent) res.writeHead(500).end();
    else res.destroy();
  }
});

server.listen(Number(process.env.PORT ?? 7065), process.env.HOST ?? "0.0.0.0", () => {
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Missing server address");
  console.log(`Hacker News On This Day listening on ${address.port}`);
});

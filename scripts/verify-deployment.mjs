import { resolve } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath } from "node:url";

const origin = "https://hntoday.hexly.ai";
const image = "ghcr.io/nocoo/hackernews-on-this-day";

export function validateManifest(sourceSha, manifest) {
  if (!/^[a-f0-9]{40}$/.test(sourceSha)) throw new Error("Invalid source SHA");
  let releases;
  try {
    releases = JSON.parse(manifest);
  } catch {
    throw new Error("Invalid image manifest");
  }
  if (!Array.isArray(releases) || releases.length !== 1) throw new Error("Expected exactly one image");
  const [release] = releases;
  if (
    release?.image !== image ||
    release.service !== "web" ||
    release.sourceSha !== sourceSha ||
    !/^sha256:[a-f0-9]{64}$/.test(release.digest ?? "")
  ) {
    throw new Error("Image manifest does not prove the expected digest and revision");
  }
  return release;
}

export async function verifyDeployment({
  sourceSha,
  manifest,
  now = new Date(),
  fetchImpl = fetch,
  sleep = delay,
}) {
  const release = validateManifest(sourceSha, manifest);
  const date = `month=${now.getUTCMonth() + 1}&day=${now.getUTCDate()}`;
  let lastError;
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const options = { redirect: "error", signal: AbortSignal.timeout(10_000) };
      const liveResponse = await fetchImpl(`${origin}/api/live`, options);
      const live = await liveResponse.json();
      if (
        liveResponse.status !== 200 ||
        liveResponse.headers.get("cache-control") !== "no-store" ||
        live?.status !== "ok" ||
        live.component !== "hntoday" ||
        live.revision !== sourceSha
      ) {
        throw new Error("Public liveness does not match the deployed revision");
      }
      const archiveResponse = await fetchImpl(`${origin}/api/day?${date}`, options);
      const archive = await archiveResponse.json();
      if (
        archiveResponse.status !== 200 ||
        archiveResponse.headers.get("cache-control") !== "no-store" ||
        !Array.isArray(archive?.years) ||
        archive.years.length === 0 ||
        !Array.isArray(archive.missingYears) ||
        archive.missingYears.length !== 0
      ) {
        throw new Error("Public archive is unavailable or incomplete");
      }
      const page = await fetchImpl(`${origin}/`, options);
      if (
        page.status !== 200 ||
        !page.headers.get("content-type")?.includes("text/html") ||
        !(await page.text()).includes("Hacker News")
      ) {
        throw new Error("Public homepage is unavailable");
      }
      return `${release.image}@${release.digest} from ${sourceSha} is healthy at ${origin}`;
    } catch (error) {
      lastError = error;
      if (attempt < 4) await sleep(3000);
    }
  }
  throw new Error(
    `Public verification failed: ${lastError instanceof Error ? lastError.message : "request failed"}`,
  );
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  verifyDeployment({ sourceSha: process.env.SOURCE_SHA ?? "", manifest: process.env.RELEASE_IMAGES ?? "" })
    .then((message) => console.log(message))
    .catch((error) => {
      console.error(error.message);
      process.exitCode = 1;
    });
}

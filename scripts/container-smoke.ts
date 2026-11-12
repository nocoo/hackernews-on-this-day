import { execFileSync, spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { chmod } from "node:fs/promises";
import { createArchiveFixture } from "../tests/fixtures/archive";

const archive = await createArchiveFixture();
const tag = `hntoday-test:${randomUUID()}`;
const name = `hntoday-test-${randomUUID()}`;
const revision = process.env.GITHUB_SHA ?? "a".repeat(40);
let built = false;
let container = false;
const docker = (args: string[]) =>
  execFileSync("docker", args, { encoding: "utf8", timeout: 600_000 }).trim();
let failure: unknown;
let failed = false;

try {
  if (!/^[a-f0-9]{40}$/.test(revision)) throw new Error("Invalid test revision");
  await chmod(archive.directory, 0o755);
  const build = ["build", "--tag", tag];
  if (process.env.BUN_CONFIG_REGISTRY)
    build.push("--build-arg", `NPM_REGISTRY=${process.env.BUN_CONFIG_REGISTRY}`);
  execFileSync("docker", [...build, "."], { stdio: "inherit", timeout: 600_000 });
  built = true;
  docker(["run", "--rm", "--entrypoint", "sh", tag, "-c", "test ! -e /data"]);
  container = true;
  docker([
    "run",
    "--detach",
    "--name",
    name,
    "--publish",
    "127.0.0.1::7065",
    "--env",
    `APP_REVISION=${revision}`,
    "--volume",
    `${archive.directory}:/data:ro`,
    tag,
  ]);
  const binding = docker(["port", name, "7065/tcp"]);
  const port = Number(binding.split(":").at(-1));
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("Invalid container port");
  const url = `http://127.0.0.1:${port}`;
  let live: Response | undefined;
  for (let attempt = 0; attempt < 40; attempt++) {
    try {
      live = await fetch(`${url}/api/live`, { signal: AbortSignal.timeout(1000) });
      break;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
  }
  if (live?.status !== 200 || live.headers.get("cache-control") !== "no-store")
    throw new Error("Container liveness unavailable");
  const health = (await live.json()) as { status: string; component: string; revision: string };
  if (health.status !== "ok" || health.component !== "hntoday" || health.revision !== revision)
    throw new Error("Container revision mismatch");
  const page = await fetch(url, { signal: AbortSignal.timeout(10_000) });
  if (
    page.status !== 200 ||
    !page.headers.get("content-type")?.includes("text/html") ||
    !(await page.text()).includes("Hacker News")
  )
    throw new Error("Container homepage unavailable");
  const response = await fetch(`${url}/api/day?month=11&day=12`, { signal: AbortSignal.timeout(10_000) });
  const data = (await response.json()) as {
    years: Array<{ year: number; stories: Array<{ title: string }> }>;
    missingYears: number[];
  };
  if (
    response.status !== 200 ||
    data.missingYears.length ||
    data.years.length !== 15 ||
    data.years[0].stories[0].title !== `Synthetic story ${archive.currentYear - 1}`
  )
    throw new Error("Mounted fixture archive failed");
  const mounts = JSON.parse(docker(["inspect", "--format", "{{json .Mounts}}", name])) as Array<{
    Destination: string;
    RW: boolean;
  }>;
  if (!mounts.some((mount) => mount.Destination === "/data" && !mount.RW))
    throw new Error("Archive mount is not read-only");
  console.log(`Container smoke passed: revision ${revision}, ${data.years.length} years, read-only fixture`);
} catch (error) {
  failure = error;
  failed = true;
}

async function cleanup() {
  const errors: unknown[] = [];
  try {
    if (container) {
      const inspected = spawnSync("docker", ["inspect", name], { stdio: "ignore" });
      if (inspected.error || (inspected.status !== 0 && inspected.status !== 1))
        throw new Error("Cannot inspect test container");
      if (inspected.status === 0) docker(["rm", "--force", name]);
    }
  } catch (error) {
    errors.push(error);
  }
  try {
    if (built) docker(["image", "rm", tag]);
  } catch (error) {
    errors.push(error);
  }
  try {
    await archive.cleanup();
  } catch (error) {
    errors.push(error);
  }
  if (errors.length) throw new AggregateError(errors, "Container test cleanup failed");
}

try {
  await cleanup();
} catch (error) {
  if (failed) throw new AggregateError([failure, error], "Container test and cleanup failed");
  throw error;
}
if (failed) throw failure;

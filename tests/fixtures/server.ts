import { spawn } from "node:child_process";

export async function startFixtureServer(dataDirectory: string, port = 0) {
  const child = spawn("node", ["dist/server/index.js"], {
    env: { ...process.env, HOST: "127.0.0.1", PORT: String(port), DATA_DIR: dataDirectory },
    stdio: ["ignore", "pipe", "pipe"],
  });
  const exited = new Promise<number | null>((resolve) => child.once("exit", resolve));
  let output = "";
  child.stderr.on("data", (chunk: Buffer) => {
    output += chunk.toString();
  });
  const address = await new Promise<number>((resolve, reject) => {
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new Error(`Fixture server did not start: ${output}`));
    }, 10_000);
    child.stdout.on("data", (chunk: Buffer) => {
      output += chunk.toString();
      const match = /Hacker News On This Day listening on (\d+)/.exec(output);
      if (match) {
        clearTimeout(timer);
        resolve(Number(match[1]));
      }
    });
    child.once("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.once("exit", (code) => {
      clearTimeout(timer);
      reject(new Error(`Fixture server exited ${code}: ${output}`));
    });
  });
  return {
    url: `http://127.0.0.1:${address}`,
    exited,
    stop: async () => {
      if (child.exitCode !== null || child.signalCode !== null) return;
      child.kill("SIGTERM");
      const timer = setTimeout(() => child.kill("SIGKILL"), 5000);
      try {
        await exited;
      } finally {
        clearTimeout(timer);
      }
    },
  };
}

import { createArchiveFixture } from "../tests/fixtures/archive";
import { startFixtureServer } from "../tests/fixtures/server";

const archive = await createArchiveFixture();
let server: Awaited<ReturnType<typeof startFixtureServer>>;
try {
  server = await startFixtureServer(archive.directory, 27065);
} catch (error) {
  await archive.cleanup();
  throw error;
}
console.log(`Browser fixture ready at ${server.url}`);

let stopping = false;
async function stop(exitCode = 0) {
  if (stopping) return;
  stopping = true;
  try {
    await server.stop();
    await archive.cleanup();
    process.exit(exitCode);
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
}
process.on("SIGINT", () => {
  void stop();
});
process.on("SIGTERM", () => {
  void stop();
});
void server.exited.then(() => stop(1));

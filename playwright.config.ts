import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./browser",
  forbidOnly: true,
  use: {
    baseURL: "http://127.0.0.1:27065",
    browserName: "chromium",
    locale: "zh-CN",
    screenshot: "only-on-failure",
    launchOptions: process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {},
  },
  webServer: {
    command: "exec bun run scripts/browser-server.ts",
    url: "http://127.0.0.1:27065/api/live",
    reuseExistingServer: false,
    gracefulShutdown: { signal: "SIGTERM", timeout: 10000 },
    timeout: 30000,
  },
});

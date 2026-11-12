import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./browser",
  use: {
    baseURL: "http://127.0.0.1:27065",
    browserName: "chromium",
    launchOptions: process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {},
  },
  webServer: {
    command: "bunx vite --host 127.0.0.1 --port 27065 --strictPort",
    url: "http://127.0.0.1:27065",
    reuseExistingServer: false,
    timeout: 30000,
  },
});

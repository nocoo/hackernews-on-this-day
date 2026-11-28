import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    allowOnly: false,
    include: ["tests/**/*.test.ts"],
    coverage: {
      provider: "v8",
      include: ["src/calendar.ts", "src/i18n.ts", "server/api.ts", "server/archive.ts"],
      reporter: ["text", "lcov"],
      thresholds: { statements: 90, lines: 90, functions: 90, branches: 85 },
    },
  },
});

import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    allowOnly: false,
    include: ["tests/**/*.test.ts"],
    coverage: {
      provider: "v8",
      include: ["src/calendar.ts", "src/i18n.ts", "server/api.ts", "server/archive.ts"],
      reporter: ["text", "lcov"],
      thresholds: { statements: 95, branches: 95, functions: 95, lines: 95 },
    },
  },
});

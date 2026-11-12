import { defineConfig } from "vite";

export default defineConfig({
  build: {
    outDir: "dist/server",
    ssr: "server/index.ts",
    rollupOptions: { external: ["@duckdb/node-api"] },
    emptyOutDir: true,
  },
});

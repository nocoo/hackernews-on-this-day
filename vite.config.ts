import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { handleApi } from "./server/api.ts";

export default defineConfig({
  plugins: [
    react(),
    {
      name: "archive-api",
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          void handleApi(req, res).then((handled) => {
            if (!handled) next();
          }, next);
        });
      },
    },
  ],
  server: { host: "127.0.0.1", port: 7065, strictPort: true, allowedHosts: ["hntoday.dev.hexly.ai"] },
});

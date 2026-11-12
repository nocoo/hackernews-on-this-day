FROM oven/bun:1.4.4 AS dependencies
WORKDIR /app
COPY package.json bun.lock ./
ARG NPM_REGISTRY
RUN if [ -n "$NPM_REGISTRY" ]; then BUN_CONFIG_REGISTRY="$NPM_REGISTRY" bun install --frozen-lockfile; else bun install --frozen-lockfile; fi

FROM dependencies AS build
COPY index.html tsconfig.json vite.config.ts vite.server.config.ts ./
COPY src ./src
COPY server ./server
RUN bun run build

FROM oven/bun:1.4.4 AS production-dependencies
WORKDIR /app
COPY package.json bun.lock ./
ARG NPM_REGISTRY
RUN if [ -n "$NPM_REGISTRY" ]; then BUN_CONFIG_REGISTRY="$NPM_REGISTRY" bun install --production --frozen-lockfile; else bun install --production --frozen-lockfile; fi

FROM node:24-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production PORT=7065 DATA_DIR=/data
COPY --from=production-dependencies /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY package.json ./package.json
USER node
EXPOSE 7065
CMD ["node", "dist/server/index.js"]

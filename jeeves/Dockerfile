# syntax=docker/dockerfile:1
FROM node:24.21.0-alpine3.23 AS base
RUN npm install --global pnpm@12.16.1
WORKDIR /app

FROM base AS build
COPY . .
RUN --mount=type=cache,id=jeeves-pnpm,target=/pnpm/store \
    pnpm install --frozen-lockfile --store-dir /pnpm/store
RUN pnpm --filter @jeeves/web build

FROM base AS production-dependencies
COPY . .
RUN --mount=type=cache,id=jeeves-pnpm,target=/pnpm/store \
    pnpm --filter @jeeves/server... install --prod --frozen-lockfile --store-dir /pnpm/store

FROM base AS runtime
RUN apk add --no-cache bash ca-certificates font-dejavu nginx \
    postgresql17 postgresql17-client su-exec tini

COPY --from=production-dependencies /app/node_modules ./node_modules
COPY --from=production-dependencies /app/jeeves/apps/server ./jeeves/apps/server
COPY --from=production-dependencies /app/jeeves/packages ./jeeves/packages
# Trusted generator implementations/assets only; no field app or runtime is packaged.
COPY --from=production-dependencies /app/jeeves-generator/node_modules ./jeeves-generator/node_modules
COPY --from=production-dependencies --chown=node:node /app/jeeves-generator/package.json ./jeeves-generator/package.json
COPY --from=production-dependencies --chown=node:node /app/jeeves-generator/src ./jeeves-generator/src
COPY --from=production-dependencies --chown=node:node /app/jeeves-generator/templates ./jeeves-generator/templates
COPY --chown=node:node field-projects/youtube/v1/inputs/*.json ./field-projects/youtube/v1/inputs/
COPY --chown=node:node field-projects/youtube/v1/diagrams/005-local-intent-aligned/diagram.png ./field-projects/youtube/v1/diagrams/005-local-intent-aligned/diagram.png
COPY --chown=node:node package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY patches ./patches
COPY tooling/tsconfig.base.json ./tooling/tsconfig.base.json
COPY --from=build /app/jeeves/apps/web/dist ./jeeves/apps/web/dist
COPY jeeves/docker/nginx.conf /etc/nginx/nginx.conf
COPY --chmod=755 jeeves/docker/entrypoint.sh /usr/local/bin/jeeves

ENV NODE_ENV=production \
    JEEVES_HOME=/data/settings \
    JEEVES_SERVER_PORT=4310 \
    PGDATA=/data/postgres
VOLUME ["/data"]
EXPOSE 4300
STOPSIGNAL SIGTERM
HEALTHCHECK --interval=15s --timeout=5s --start-period=60s --retries=3 \
    CMD wget -q -O /dev/null http://127.0.0.1:4300/api/health || exit 1
ENTRYPOINT ["/sbin/tini", "--", "/usr/local/bin/jeeves"]

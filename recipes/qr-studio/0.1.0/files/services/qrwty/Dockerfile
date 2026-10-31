# Image for qrwty API. Project-owned: change it if the service needs system packages.
# docker-compose.yml builds it from the project root, so vendored Jeeves runtimes (vendor/jeeves)
# and API contracts (contracts/) are in the build context; Dockerfile.dockerignore keeps the
# rest out. Node runs the TypeScript sources directly (type stripping), so there's no build step.
FROM node:24.22.2-alpine
ENV NODE_ENV=production
WORKDIR /app
RUN corepack enable
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY vendor/jeeves/ vendor/jeeves/
COPY services/qrwty/package.json services/qrwty/
COPY services/qrwty/artifacts/ services/qrwty/artifacts/
# Saved artwork pins the renderer's transitive dependencies as well as its own artifact version.
RUN pnpm --filter './services/qrwty' install --prod --frozen-lockfile
COPY . .
WORKDIR /app/services/qrwty
USER node
CMD ["node", "src/main.ts"]

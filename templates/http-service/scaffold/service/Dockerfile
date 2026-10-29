# Image for {{serviceName}}. Project-owned: change it if the service needs system packages.
# docker-compose.yml builds it from the project root, so vendored Jeeves runtimes (vendor/jeeves)
# and API contracts (contracts/) are in the build context; Dockerfile.dockerignore keeps the
# rest out. Node runs the TypeScript sources directly (type stripping), so there's no build step.
FROM node:24.22.2-alpine
ENV NODE_ENV=production
WORKDIR /app
COPY vendor/jeeves/ vendor/jeeves/
COPY {{serviceDir}}/package.json {{serviceDir}}/
RUN cd {{serviceDir}} && npm install --omit=dev --no-audit --no-fund --no-package-lock
COPY . .
WORKDIR /app/{{serviceDir}}
USER node
CMD ["node", "src/main.ts"]

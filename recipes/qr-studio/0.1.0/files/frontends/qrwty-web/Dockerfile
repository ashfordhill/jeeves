# Image for qrwty web. Project-owned: change it if the build needs more. docker-compose.yml
# builds it from the project root, so vendored Jeeves runtimes (vendor/jeeves) are in the build
# context; Dockerfile.dockerignore keeps the rest out. Vite builds the static files, and nginx
# serves them and forwards the app's API calls to the services it uses.
FROM node:24.22.2-alpine AS build
WORKDIR /app
COPY vendor/jeeves/ vendor/jeeves/
COPY frontends/qrwty-web/package.json frontends/qrwty-web/
COPY frontends/qrwty-web/artifacts/ frontends/qrwty-web/artifacts/
RUN cd frontends/qrwty-web && npm install --no-audit --no-fund --no-package-lock
COPY . .
RUN cd frontends/qrwty-web && npm run build

FROM nginx:1.30.5-alpine
# At startup the image fills ${PORT} and ${API_*} into /etc/nginx/templates/*.template, and
# @jeeves/web-runtime's script writes the runtime config (jeeves-config.json) the same way.
ENV NGINX_ENVSUBST_FILTER="^(PORT|API_)"
COPY frontends/qrwty-web/nginx/default.conf.template /etc/nginx/templates/default.conf.template
COPY frontends/qrwty-web/nginx/jeeves-config.json.template /etc/jeeves/config.json.template
COPY --from=build --chmod=755 /app/frontends/qrwty-web/node_modules/@jeeves/web-runtime/nginx/40-jeeves-config.sh /docker-entrypoint.d/
COPY --from=build /app/frontends/qrwty-web/dist/ /usr/share/nginx/html/

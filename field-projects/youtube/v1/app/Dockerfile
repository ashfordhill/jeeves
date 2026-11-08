FROM node:24.21.0-bookworm-slim@sha256:d6aa754f16b3197301076f047b5def2f02ea1dbbc2ca920407d46d7ec7f87b20 AS app
WORKDIR /app
RUN npm install --global pnpm@12.16.1
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile --ignore-scripts
COPY tsconfig.json tsconfig.browser.json ./
COPY browser ./browser
COPY public ./public
COPY src ./src
COPY scripts ./scripts
RUN pnpm build
COPY infra ./infra
CMD ["node", "dist/services/watch.js"]

FROM node:24.21.0-bookworm-slim@sha256:d6aa754f16b3197301076f047b5def2f02ea1dbbc2ca920407d46d7ec7f87b20 AS ffmpeg
WORKDIR /build
COPY infra/ffmpeg-os.lock ./ffmpeg-os.lock
# Signed apt metadata authenticates HTTP snapshot transport. Base has no CA package.
RUN rm /etc/apt/sources.list.d/debian.sources && printf 'deb [check-valid-until=no] http://snapshot.debian.org/archive/debian/20261024T000000Z bookworm main\ndeb [check-valid-until=no] http://snapshot.debian.org/archive/debian-security/20261024T000000Z bookworm-security main\n' > /etc/apt/sources.list \
 && apt-get update -o APT::Update::Error-Mode=any \
 && apt-get download ffmpeg=7:5.1.9-0+deb12u1 \
 && echo '2ba8ead87657c123ce6de2de5ecdbc1fb4ead9a4b317b85b8ec41e16c890fe01  ffmpeg_7%3a5.1.9-0+deb12u1_amd64.deb' | sha256sum -c - \
 && rm ffmpeg_*.deb \
 && apt-get install -y --no-install-recommends ffmpeg=7:5.1.9-0+deb12u1 \
 && dpkg-query -W -f='${Package}=${Version}\n' | LC_ALL=C sort > /tmp/ffmpeg-os.lock \
 && diff -u ffmpeg-os.lock /tmp/ffmpeg-os.lock \
 && test "$(dpkg-query -W -f='${Version}' ffmpeg)" = '7:5.1.9-0+deb12u1' \
 && rm -rf /var/lib/apt/lists/*
FROM ffmpeg AS transcoder
WORKDIR /app
COPY --from=app /app /app
CMD ["node", "dist/workers/transcoder.js"]

FROM nginx:1.28.3-alpine@sha256:a8b39bd9cf0f83869a2162827a0caf6137ddf759d50a171451b335cecc87d236 AS edge
COPY infra/edge/nginx.conf /etc/nginx/nginx.conf
COPY --from=app /app/dist-public /usr/share/nginx/html

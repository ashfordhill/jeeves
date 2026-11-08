#!/usr/bin/env bash
# Runs the Playwright suite inside the matching official image, for machines where
# Chromium's system libraries aren't installed (e.g. WSL without sudo).
# Postgres must already be up (`pnpm db:up`); the container shares the host network.
set -euo pipefail
cd "$(dirname "$0")/../.."
version=$(node -p "require('@playwright/test/package.json').version")
exec docker run --rm --network host --ipc host \
  -u "$(id -u):$(id -g)" -e HOME=/tmp \
  -v "$PWD:$PWD" -w "$PWD" \
  "mcr.microsoft.com/playwright:v${version}-noble" \
  bash -c 'mkdir -p /tmp/bin && corepack enable --install-directory /tmp/bin && PATH=/tmp/bin:$PATH pnpm exec playwright test -c jeeves/playwright.config.ts "$@"' -- "$@"

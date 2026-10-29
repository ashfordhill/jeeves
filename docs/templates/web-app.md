# web-app

React single-page frontend.

## Board
Element, kind `frontend`. Accepts the `rest-api-client` attachment.

## Config
- `port` (default 5173 in development, served by nginx in the container)
- `title`

## Runtime package `@jeeves/web-runtime`
App shell, runtime config injection (API base URLs from the environment at container start), an error boundary, and a provider for generated API clients.

## Scaffold
Vite + React + TypeScript project: `src/main.tsx`, `src/App.tsx`, `src/pages/` (project-owned), `Dockerfile` (build, then nginx). Generated-owned: `src/jeeves.generated.ts`.

## Connections
Through a `rest-api-client` attachment.

## Test pack
Playwright: the page loads without console errors; runtime config is applied; with a connected service, a sample call renders its result.

## Open questions
- ~~Mantine as the default UI kit for generated frontends (matches Jeeves), or unstyled?~~ Unstyled: plain React with a small `styles.css` (S9). Mantine would add install time and image size to every frontend and fix a look the user hasn't chosen; the agent guide says adding a UI library is fine.

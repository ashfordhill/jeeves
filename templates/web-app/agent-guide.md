# Working with a web-app element

This is a React single-page app (Vite, TypeScript) running on `@jeeves/web-runtime`. In its
container, nginx serves the build and forwards the app's API calls to the services it uses.

## Where things go

- **Pages and components:** `src/pages/` and `src/components/`; the layout and routing are in
  `src/App.tsx`. Add a router (for example `react-router`) when there's more than one page:
  nginx already serves the app for any path.
- **Calling a service:** through its generated client (one per rest-api-client attachment; see
  that template's guide). In components, get clients from `useApis()` so tests can swap them:

  ```tsx
  import { useApis } from "@jeeves/web-runtime";
  import type { app } from "../jeeves.generated.ts";

  export function LinkList() {
    const { links } = useApis<typeof app.apis>();
    // e.g. in an effect: const { data, error } = await links.GET("/links");
  }
  ```

- **Settings that differ per environment** come from the runtime config: `useRuntimeConfig()`
  (or `runtimeConfig()` outside components). The title is `APP_TITLE`; API addresses are in
  `apis`. Don't bake them into the build with `import.meta.env`.
- **Errors:** the whole app is inside an `ErrorBoundary`; wrap risky parts in their own
  `<ErrorBoundary fallback={(error, reset) => ...}>` so one failure doesn't blank the page.
- **Styles:** `src/styles.css` is plain CSS. Adding a UI library is fine; pin its version.
- **Tests:** `test/*.test.tsx` with Vitest; render components inside
  `<JeevesProvider config={...} apis={{ links: fakeClient }}>`.
- **Dependencies:** add npm packages to this app's `package.json` with exact versions.
- **Running it locally:** `npm run dev`. Set `API_<TARGET>_URL` to each service's published
  address (`docker compose port <service> <port>`) so the dev server can forward API calls.

## Don't

- Don't edit `src/jeeves.generated.ts`, `src/clients/*.generated.ts`, anything in `nginx/`,
  `docker-compose.yml`, or `vendor/`. They're generated from the design and overwritten.
- Don't call services by their own URLs or with plain `fetch`; go through the generated client
  (the browser can only reach them through `/_api/<service>/`).
- Don't remove the `startApp(...)` call in `src/main.tsx` or the `#root` element.
- Don't put secrets in the app: everything in it is visible to users. Tokens for APIs are added
  by nginx.
- Don't log with `console.error` for expected situations: Jeeves's checks fail on console errors.

## Checks Jeeves runs

The page loads with no console errors, any path serves the app, the runtime config comes from
the container's environment and is applied (the page title), and for each connected service a
sample call through its client renders a result on `/_jeeves/status`.

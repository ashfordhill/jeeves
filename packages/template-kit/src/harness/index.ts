// Docker-backed conformance harness: builds a project from templates and starts it with
// Testcontainers. Needs Docker; used by `pnpm test:templates`, never by `pnpm check`.
export * from "./environment.ts";
export * from "./project.ts";

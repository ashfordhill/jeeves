# Fixture designs

Example design documents used by tests (`packages/registry/src/fixtures.test.ts`) and later sections. They use the built-in v1 templates.

| File | What it is | Expected findings |
| --- | --- | --- |
| `link-shortener.json` (+ `.layout.json`) | Web app with a REST client calling a service with a REST server, backed by Postgres. The S10 baseline fixture. | None |
| `incomplete.json` | Saveable but not generatable: a "needs a template" element, a web app with no title, a client with no target | Readiness only: `NEEDS_TEMPLATE`, `CONFIG_REQUIRED`, `UNCONNECTED_REQUIRED_PORT` |
| `invalid.json` | Structurally broken: bad config, unknown template, an attachment the element can't take, an incompatible and a dangling connection | Structural; `applyOperations` would never produce it |

If you change one, update the expectations in the test.

# automation-pitch reuse notes

Draw Jeeves takes its visual style and editor foundation from `~/github/automation-pitch` (React 19, Vite, Mantine, Tabler icons, @xyflow/react, ELK, Zustand, Zod 4, Vitest, Playwright). Section S1 of [PLAN.md](../../PLAN.md) decides exactly which files to adapt.

Notes carried over from the earlier plan (inspected 2026-10-28; tests were not rerun):

### Automation-pitch: build on existing editing experience

The README explicitly anticipates using its workflow schema to create software scaffolds, map tasks to reusable skills/scripts, and reuse end-to-end patterns. It also documents the manual agent relay used to build the app. That provides a direct precursor for Jeeves. Source: [README](../../../automation-pitch/README.md).

| Existing code/pattern | Candidate use in Draw Jeeves | Adaptation needed |
| --- | --- | --- |
| `src/board/`, custom React Flow nodes, contextual controls | Canvas interaction and readable component cards | Typed service/resource ports and editable template configuration |
| `src/board/layout/` and ELK integration | Layout, orientation, stable rendering | Architecture graphs with disconnected drafts and permitted runtime cycles |
| `src/app/inspector/`, theme and shell components | Cohesive inspector and visual language | Template-driven fields and requirement/status presentation |
| `src/state/history.ts`, persistence/recovery | Undo, saved-document recovery | Backend transactions, revision conflicts, grouped agent edits, independent semantic/layout state |
| `src/workflow/serialize.ts`, schema/migration code | Versioned files and import/export behavior | A Jeeves specification and explicit `.illustrator` mapping rather than interpreting workflow files as deployable systems |
| `src/export/` | Shareable design images | Rendering the new semantic node families |
| `e2e/` and visual evidence conventions | Browser interactions, accessibility, visual regression evidence | New Draw contracts and an independently verified baseline |

Inspect [graph rules](../../../automation-pitch/src/workflow/graph.ts), [commands](../../../automation-pitch/src/workflow/commands.ts), [history](../../../automation-pitch/src/state/history.ts), and [serialization](../../../automation-pitch/src/workflow/serialize.ts) when deciding what to extract. The current graph model rejects cycles and assumes a rooted workflow, whereas Draw must support incomplete architecture drafts and distinguish communication graphs from build DAGs. Its snapshot history also stores workflow documents, so it is not yet the proposed server transaction mechanism.

The current README records design lessons: prioritize ease of use and comprehension; avoid overly complex merge abstractions; use the inspector when full inline editing harms readability. Adapt these lessons rather than reproducing every feature or historical control. The older build/review documents contain superseded behavior, so current code and amendments take precedence when assessing reuse.

The latest inspected handoff (Improvement 69) reports a passing build/unit suite and eight existing browser-test failures. Those are historical reported results; tests were not rerun for this planning task. Reuse needs a measured baseline rather than a claim that the whole editor is already verified for Jeeves. Source: [handoff](../../../automation-pitch/.docs/handoff.md).

The existing relay process suggests a repository-adoption manifest: goal/requirement IDs, scoped work packets, predecessor outputs, verification commands, evidence references, known baseline failures, and append-only handoff records. Jeeves can automate that coordination while making the next ready task, its context, and its evidence visible in the UI.

# Editor extraction from automation-pitch

Written in S1 (2026-10-28). Source: `~/github/automation-pitch` at commit `0803c4a` (Improvement 69). This records what Jeeves took, what it left, and why, so later sections don't have to re-survey the source repo.

## License

automation-pitch has no `LICENSE` file and no license field in `package.json`. It's the same author's own repository (`ashfordhill/automation-illustrator`), so there are no third-party copyright or license notices to carry. Copied files say where they came from in their header comment.

## Copied or adapted in S1

| Jeeves file | Source | What changed |
| --- | --- | --- |
| `apps/web/src/theme/tokens.css` | `src/app/styles/tokens.css`, `src/app/components/StatusBar.css` | Kept the Ice light/dark palette, `html/body` base, `.chrome-bar` + Mantine ActionIcon overrides, status bar and toggle styles, the view-switch styles, `.visually-hidden`, and the grab/grabbing cursors (renamed `--grab-cursor`, `--grabbing-cursor`; S4's Hand tool needs them). Dropped ~2,000 lines of tile, lane, present-mode, inspector and simplify styles. Added the Jeeves shell rules at the end. |
| `apps/web/src/theme/mantineTheme.ts` | `createTheme` block in `src/app/App.tsx` | Unchanged values: Nunito Variable, `defaultRadius: "md"`, cyan primary, pointer cursor. |
| `apps/web/src/theme/PaperTexture.tsx` | `src/board/PaperTexture.tsx`, `GRID` from `src/board/layout/tileMetrics.ts` | Kept `TextureCell` and `PaperTextureSvg` (dots/rings/cross/mesh). Removed the React Flow `useViewport` wrapper, since there's no canvas yet; S4 should add it back next to the canvas. |
| `apps/web/src/shell/ViewTabs.tsx` | `src/app/components/ViewSwitch.tsx` | Same look (`.view-switch`), but text labels and `role="tablist"` with arrow-key movement instead of radio buttons with figure icons. |
| `apps/web/src/shell/StatusBar.tsx` | `src/app/components/StatusBar.tsx`, `SoundToggle.tsx` | Same fixed footer; shows server health, a dark-mode toggle, and the version. |
| `apps/web/src/App.tsx` | `src/app/App.tsx` | Same header / paper stage / status bar arrangement and `data-theme` + `forceColorScheme` approach. Uses plain positioned elements instead of Mantine `AppShell` because there's no aside yet. |
| `apps/web/src/vitest.setup.ts` | `src/vitest.setup.ts` | Copied as is (jsdom stubs for Mantine and, later, React Flow). |
| `apps/web/public/favicon.svg` | `public/favicon.svg` | Copied as is; replace when Jeeves has its own mark. |
| Dependency versions | `package.json` / installed `node_modules` | React, Mantine, Tabler, Vite, Vitest, Playwright, axe, jsdom, Nunito, and TypeScript are pinned to the versions automation-pitch has installed. |

## Adapted in S4 (board)

| Jeeves file | Source | What changed |
| --- | --- | --- |
| `apps/web/src/draw/Canvas.tsx` (`BoardTexture`) | `src/board/PaperTexture.tsx` (`PaperTexture`) | Same idea: the S1 `PaperTextureSvg` fed with `useViewport()` so the paper follows the camera. |
| `apps/web/src/draw/draw.css` (handles, cards, edges) | `src/app/styles/tokens.css` (`.react-flow__handle*`, `.react-flow__edge-path`), `src/board/tiles/StepTile.tsx` | Handle shape and colors copied, scoped to `.card-handle`. Element cards reuse the step tile's 3px `--line` border, 14px radius, `--cream` fill and `--shadow`. The hand tool uses the S1 `--grab-cursor` / `--grabbing-cursor`. |
| `apps/web/src/draw/nodes/ElementNode.tsx` | `src/board/nodes/StepNode.tsx` | Same pattern (a React Flow node rendering a tile with left/right handles), but attachment mini-boxes carry their own handles. |

Not used after all: `reactFlowBridge.ts`, `zoom.ts`, `firstLayoutCamera.ts`, `routing/` (`FlowArrow`, `polyline`), `tiles/FitLabel`, and `Toolbar.tsx`. They're bound to automation-pitch's lane layout and store. Jeeves uses React Flow's built-in bezier edges, `fitView`, and `Controls`, and an Excalidraw-style floating toolbar written fresh.

## Left for later sections (adapt when needed)

| Source | Use in | Notes |
| --- | --- | --- |
| `src/board/layout/elk*.ts`, `warmLayout.ts` | S6 auto-placement (§7) | Its layered layout assumes a rooted acyclic workflow; Jeeves only needs "place new nodes near X", and must allow cycles. |
| `src/app/inspector/` (`InspectorFold`, `InspectorField`, `SelectedItemForm`) and the `AppShell` aside setup in `App.tsx` | S5 inspector | Fold-to-strip rail; field layout. |
| `src/app/components/ChromeToolCluster.tsx` | S5 undo/redo | Hamburger + undo/redo cluster styling. |
| `src/app/sound/cues.ts`, `SoundToggle.tsx` | S5 or later | Optional sounds (§5). Not added in S1 because the shell has no actions worth a cue. |
| `src/app/theme/` (ThemeModal, presets, texture picker) | Optional, after v1 | Four built-in themes (Ice, Graphite, Forest, Plum) are defined in `chromeTheme.ts`. Jeeves ships Ice only for now. |
| `src/keyboard/` | S5 shortcuts | Rebindable keymap; shortcuts must stay optional. |
| `src/export/` | After v1 | Board-to-image export. |
| `e2e/` helpers and axe usage | S5 | Their Playwright patterns for drag, React Flow, and axe. |

## Left behind (not planned)

- `src/workflow/` (schema, graph, commands, serialize, migrate): automation-pitch's workflow model. Jeeves's design model is `packages/spec` (S2), and undo/history is server-side (S3). Its graph rules reject cycles, which Jeeves allows.
- `src/state/` (Zustand store, `history.ts`, `persistence.ts`, `fileSave.ts`): client-side snapshot history and localStorage/file persistence. Jeeves persists through the operations API.
- Before/After lanes, Compare, Present mode, simplify/word-web, actors and the human/robot figures, demos, `render.html`.

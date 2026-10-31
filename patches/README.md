# React Flow resize delivery

`@xyflow/react@12.11.6.patch` batches node measurements into the next animation frame instead of updating node internals inside ResizeObserver delivery. The original synchronous update produces native `ResizeObserver loop completed with undelivered notifications` errors during the mouse resize journey. Deferring only Jeeves's controlled `onNodesChange` callback was insufficient because the upstream observer also writes its internal store.

The patch covers both ESM entry points used by this ESM workspace (browser `index.js` and Node `index.mjs`). It coalesces measurements by node, cancels pending work on cleanup, and does not suppress any error. The CommonJS/UMD entry is unused and unchanged. pnpm applies the version-pinned patch and records its hash in the lockfile.

Reassess on React Flow upgrades. Remove the patch only after the editor interaction, draw, inspector and resource-editor browser tests pass without native error events. These tests include actual mouse resizing, inspector collapse/expansion, connection handles and persisted layout.

# React Flow resize delivery

`@xyflow/react@12.11.6.patch` batches node measurements into the next animation frame instead of
updating node internals inside ResizeObserver delivery. The synchronous upstream update produces
native `ResizeObserver loop completed with undelivered notifications` errors while React Flow
measures the board's tiles. Deferring only Jeeves's own `onNodesChange` callback is not enough,
because the upstream observer also writes its internal store.

The patch covers both ESM entry points (browser `index.js` and Node `index.mjs`). It coalesces
measurements by node, cancels pending work on cleanup and suppresses no error. The CommonJS/UMD
entry is unused and unchanged. pnpm applies the version-pinned patch and records its hash in the
lockfile.

Reassess on React Flow upgrades. Remove the patch only when the E2E smoke set and a manual pass
over the lane canvas (resizing the window, collapsing and resizing the chat and inspector rails)
show no native ResizeObserver error.

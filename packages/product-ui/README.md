# @jeeves/product-ui 0.1

Product layout primitives extracted from qrwty, independent of QR codes, networking, auth and routing. `ProductShell` accepts an application name, navigation links, optional mark/tagline/footer and content. Links are anchors; the consumer owns the route and `current` state. `PageHeader`, `Feedback` and `EmptyState` supply a consistent hierarchy and accessible status/error presentation. Import `@jeeves/product-ui/styles.css` once.

The shell becomes a top navigation below 800px; it never hides navigation behind a keyboard-only interaction. A skip link targets its main landmark. Consumers override the scoped `--jui-*` tokens for brand colors. CSS is scoped to `jui-` classes; no global reset or font/network request is imposed. Loading, data and session ownership remain in the consumer.

Workspace imports use TypeScript source. `pnpm --filter @jeeves/product-ui pack --pack-destination <directory>` builds a compiled ESM artifact with declarations; installed consumers need no Jeeves checkout. Store consumer artifacts in project-owned paths, never replace protected template runtimes. Changes to the published artifact require a version change. This first manual adoption does not yet make an entire product regenerable; deterministic template composition is a separate package.

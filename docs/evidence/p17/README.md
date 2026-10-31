# P17 Studio visual evidence

Captured from the disposable qrwty Studio checkout with synthetic account/QR data; no real user data. The desktop (1440px) and phone (390px) captures show a saved revision, editable colors/shapes, server preview, immutable exports and bounded history. Images were inspected after control styling and mobile sticky-action improvements. The full-page phone capture is long because the three desktop columns stack; Save remains sticky during scrolling.

Reproduce in the adopted qrwty checkout: `pnpm --filter qrwty-web test`. Its `tests/workflows.test.ts` includes the responsive Studio journey, axe scan, overflow check and screenshot capture. Screenshots are written under `/tmp/jeeves-p17-screenshots/`. The fixture serves real renderer bytes through its HTTP API; the separate composed acceptance checks the actual database/API/frontend.

Evidence is limited to Chromium, these two viewport widths, the tested states and selected accessibility rules. It is not a guarantee of print scanning, every assistive technology or every device.

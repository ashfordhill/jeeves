// Side-by-side before/after sheets (left: SG06, right: SG07).
import { readFileSync } from "node:fs";
import { chromium } from "/home/ash/github/jeeves/node_modules/.pnpm/playwright@1.63.0/node_modules/playwright/index.mjs";

const E = "/home/ash/github/jeeves/docs/evidence/studio-grid";
const pairs = [
  [
    "SG06/screenshots/1440x900-C2-fit.png",
    "SG07/screenshots/1440x900-C2-fit.png",
    "compare-tinyurl-1440x900-C2.png",
    "SG06 TinyURL C2 1440x900 (Fit)",
    "SG07 TinyURL C2 1440x900 (Fit)",
  ],
  [
    "SG06/screenshots/1280x800-C2-fit.png",
    "SG07/screenshots/1280x800-C2-fit.png",
    "compare-tinyurl-1280x800-C2.png",
    "SG06 TinyURL C2 1280x800 (Fit)",
    "SG07 TinyURL C2 1280x800 (Fit)",
  ],
  [
    "SG06/screenshots/1440x900-C3-fit.png",
    "SG07/screenshots/1440x900-C3-fit.png",
    "compare-tinyurl-1440x900-C3.png",
    "SG06 TinyURL C3 1440x900 (Fit)",
    "SG07 TinyURL C3 1440x900 (Fit)",
  ],
  [
    "SG06/screenshots/1280x800-C3-fit.png",
    "SG07/screenshots/1280x800-C3-fit.png",
    "compare-tinyurl-1280x800-C3.png",
    "SG06 TinyURL C3 1280x800 (Fit)",
    "SG07 TinyURL C3 1280x800 (Fit)",
  ],
  [
    "SG06/screenshots/1440x900-streamly-C2-fit.png",
    "SG07/screenshots/1440x900-streamly-C2-fit.png",
    "compare-streamly-C2.png",
    "SG06 Streamly C2 (Fit)",
    "SG07 Streamly C2 (Fit)",
  ],
  [
    "SG06/screenshots/1440x900-streamly-C3-fit.png",
    "SG07/screenshots/1440x900-streamly-C3-fit.png",
    "compare-streamly-C3.png",
    "SG06 Streamly C3 (Fit)",
    "SG07 Streamly C3 (Fit)",
  ],
];
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 2900, height: 960 } });
for (const [a, b, out, la, lb] of pairs) {
  const img = (p) => `data:image/png;base64,${readFileSync(`${E}/${p}`).toString("base64")}`;
  await page.setContent(`<body style="margin:0;display:flex;gap:20px;background:#222;color:#fff;font:20px sans-serif">
    <figure style="margin:0"><figcaption style="padding:8px">${la}</figcaption><img src="${img(a)}"></figure>
    <figure style="margin:0"><figcaption style="padding:8px">${lb}</figcaption><img src="${img(b)}"></figure></body>`);
  await page.screenshot({ path: `${E}/SG07/screenshots/${out}`, fullPage: true });
}
await browser.close();

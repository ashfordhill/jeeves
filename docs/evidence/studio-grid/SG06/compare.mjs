// Side-by-side before/after sheets (left: earlier unit's screenshot, right: SG06).
import { readFileSync } from "node:fs";
import { chromium } from "/home/ash/github/jeeves/node_modules/.pnpm/playwright@1.63.0/node_modules/playwright/index.mjs";

const E = "/home/ash/github/jeeves/docs/evidence/studio-grid";
const pairs = [
  [
    "SG01/screenshots/streamly-1440x900-C2-fit.png",
    "SG06/screenshots/1440x900-streamly-C2-fit.png",
    "compare-streamly-C2.png",
    "SG01 Streamly C2 (mouse-fitted)",
    "SG06 Streamly C2 (Fit)",
  ],
  [
    "SG05/screenshots/1440x900-C2.png",
    "SG06/screenshots/1440x900-C2-fit.png",
    "compare-tinyurl-C2.png",
    "SG05 TinyURL C2",
    "SG06 TinyURL C2 (Fit, chat collapsed)",
  ],
  [
    "SG05/screenshots/1440x900-C3.png",
    "SG06/screenshots/1440x900-C3-fit.png",
    "compare-tinyurl-C3.png",
    "SG05 TinyURL C3",
    "SG06 TinyURL C3 (Fit, chat collapsed)",
  ],
];
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 2900, height: 960 } });
for (const [a, b, out, la, lb] of pairs) {
  const img = (p) => `data:image/png;base64,${readFileSync(`${E}/${p}`).toString("base64")}`;
  await page.setContent(`<body style="margin:0;display:flex;gap:20px;background:#222;color:#fff;font:20px sans-serif">
    <figure style="margin:0"><figcaption style="padding:8px">${la}</figcaption><img src="${img(a)}"></figure>
    <figure style="margin:0"><figcaption style="padding:8px">${lb}</figcaption><img src="${img(b)}"></figure></body>`);
  await page.screenshot({ path: `${E}/SG06/screenshots/${out}`, fullPage: true });
}
await browser.close();

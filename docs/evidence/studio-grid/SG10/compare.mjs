// Side-by-side sheets at half scale: SG01 baseline (Mattermost, Streamly) vs SG10 final TinyURL.
import { readFileSync } from "node:fs";
import { chromium } from "/home/ash/github/jeeves/node_modules/.pnpm/playwright@1.63.0/node_modules/playwright/index.mjs";

const E = "/home/ash/github/jeeves/docs/evidence/studio-grid";
const browser = await chromium.launch();
for (const size of ["1440x900", "1280x800"]) {
  const [w] = size.split("x").map(Number);
  const rows = [
    ["C1", `mattermost-${size}-C1-fit.png`, `streamly-${size}-C1-fit.png`],
    ["C2", `mattermost-${size}-C2-fit.png`, `streamly-${size}-C2-fit.png`],
    ["C3", `mattermost-${size}-C3-server-fit.png`, `streamly-${size}-C3-api-fit.png`],
  ];
  const img = (p) => `data:image/png;base64,${readFileSync(`${E}/${p}`).toString("base64")}`;
  const cell = (src, cap) =>
    `<figure style="margin:0"><figcaption style="padding:4px 6px">${cap}</figcaption><img style="width:${w / 2}px" src="${img(src)}"></figure>`;
  const body = rows
    .map(
      ([level, m, s]) => `<div style="display:flex;gap:12px;margin-bottom:12px">
      ${cell(`SG01/screenshots/${m}`, `SG01 baseline · Mattermost ${level === "C3" ? "C3 (Mattermost server scope)" : level}`)}
      ${cell(`SG01/screenshots/${s}`, `SG01 baseline · Streamly ${level === "C3" ? "C3 (Platform API scope)" : level}`)}
      ${cell(`SG10/screenshots/${size}-final-${level}-fit.png`, `SG10 final · TinyURL ${level} (whole system)`)}</div>`,
    )
    .join("");
  const page = await browser.newPage({ viewport: { width: (w / 2) * 3 + 24, height: 600 } });
  await page.setContent(
    `<body style="margin:0;background:#222;color:#fff;font:14px sans-serif">${body}</body>`,
  );
  await page.screenshot({ path: `${E}/SG10/screenshots/compare-${size}.png`, fullPage: true });
  await page.close();
}
await browser.close();

import type { Browser } from "@playwright/test";
import { chromium } from "@playwright/test";
import jsQR from "jsqr";
import pngjs from "pngjs";
import { afterAll, beforeAll, expect, it } from "vitest";
import { observePageProblems } from "../../template-kit/src/page-problems.ts";
import { artworkPresets, renderArtwork } from "../src/index.ts";

let browser: Browser;
const url = "https://qr.example.test/q/12345678-1234-4123-8123-123456789abc";
beforeAll(async () => {
  browser = await chromium.launch();
});
afterAll(async () => {
  await browser?.close();
});
for (const preset of artworkPresets)
  for (const size of [256, 512, 1024] as const) {
    it(`Chromium-rendered ${preset.name} SVG at ${size}px decodes independently`, async () => {
      const result = renderArtwork(url, { ...preset.settings, size }, "svg");
      const page = await browser.newPage({
        viewport: { width: 1200, height: 1200 },
        deviceScaleFactor: 1,
      });
      const problems = observePageProblems(page);
      try {
        await page.setContent(
          `<html lang="en"><head><title>SVG conformance</title></head><body style="margin:0"><img alt="Exported QR" src="data:image/svg+xml;base64,${result.bytes.toString("base64")}" /></body></html>`,
        );
        const exported = page.getByRole("img", { name: "Exported QR" });
        await exported.waitFor();
        const screenshot = pngjs.PNG.sync.read(await exported.screenshot());
        expect([screenshot.width, screenshot.height]).toEqual([size, size]);
        expect(jsQR(new Uint8ClampedArray(screenshot.data), size, size)?.data).toBe(url);
        problems.assert("SVG renderer");
      } finally {
        problems.stop();
        await page.close();
      }
    });
  }

import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { createRequire } from "node:module";

const require = createRequire("/home/ash/github/jeeves/package.json");
const { chromium } = require("@playwright/test");
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({
  viewport: { width: 1280, height: 800 },
  baseURL: "http://127.0.0.1:4300",
});
const errors = [];
page.on("pageerror", (error) => errors.push(String(error)));
page.on("console", (message) => {
  if (message.type() === "error") errors.push(message.text());
});
const json = async (path) => {
  const response = await page.request.get(`/api${path}`);
  assert.equal(response.ok(), true);
  return response.json();
};
const listing = await json("/projects");
const before = {};
for (const project of listing.projects)
  before[project.id] = await json(`/projects/${project.id}/design`);
const tinyurl = listing.projects.find(
  (project) => project.id === "41bbd268-9244-47cc-be63-66c5e61d116c",
);
assert.ok(tinyurl, "Expected retained TinyURL study");
await page.goto(`/?project=${tinyurl.id}`);
await page.locator('.lane-canvas .board[data-layout="ready"][data-board="ready"]').waitFor();
await page.getByRole("button", { name: "Fit", exact: true }).click();
await page.locator(".lane-line-legend summary").click();
const tiles = await page.locator(".lane-canvas .board .react-flow__node").count();
const lines = await page.locator(".lane-canvas .board .react-flow__edge").count();
assert.equal(tiles, 12);
assert.equal(lines, 13);
await page.screenshot({ path: "/tmp/jeeves-fp03a/studio-tinyurl.png" });
await page.locator(".lane-line-legend summary").click();
assert.deepEqual(await json("/projects"), listing);
for (const project of listing.projects)
  assert.deepEqual(await json(`/projects/${project.id}/design`), before[project.id]);
assert.deepEqual(errors, []);
await fs.writeFile(
  "/tmp/jeeves-fp03a/browser-result.json",
  `${JSON.stringify({ checkedAt: new Date().toISOString(), browser: browser.version(), viewport: { width: 1280, height: 800 }, webPort: 4300, apiPort: 4310, project: { id: tinyurl.id, name: tinyurl.name }, tiles, lines, mouseChecks: ["TinyURL Fit", "Relationship legend open and close"], sourceAndHistoryUnchanged: true, listingUnchanged: true, checkedProjectCount: listing.projects.length, errors }, null, 2)}\n`,
);
await browser.close();
console.log(
  "TinyURL mouse check passed: 12 tiles/13 lines, zero errors, all saved designs/history and project listing unchanged.",
);

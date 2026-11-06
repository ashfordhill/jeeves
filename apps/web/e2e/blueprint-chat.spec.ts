import type { Page } from "@playwright/test";
import { design, expect, lines, ready, test, tile, tiles } from "./studio.ts";

test("serves the read-only blueprint", async ({ page, tinyurl: id }) => {
  const res = await page.request.get(`/api/projects/${id}/blueprint`);
  expect(res.status()).toBe(200);
  expect(res.headers()["cache-control"]).toBe("no-store");
  const blueprint = await res.json();
  expect(blueprint).toMatchObject({ blueprint: 2, revision: 1, findings: [], omitted: [] });
  expect(blueprint.services.map((s: { id: string }) => s.id)).toEqual([
    "analytics",
    "redirect",
    "shorten",
    "stats-api",
  ]);
  // One writer per store: the Shorten service writes the URL database, Redirect reads it.
  const access = (id: string) =>
    blueprint.connections.find((c: { id: string }) => c.id === id)?.access;
  expect(access("shorten-db")).toBe("write");
  expect(access("redirect-db")).toBe("read");
});

/** Sends a chat message that `fixtures/chat/e2e-script.json` answers. */
async function send(page: Page, message: string) {
  const open = page.getByRole("button", { name: "Open chat" });
  if (await open.isVisible()) await open.click();
  await page.getByLabel("Message").fill(message);
  await page.getByRole("button", { name: "Send", exact: true }).click();
}

test("applies a chat turn from the scripted model as one edit", async ({ page, tinyurl: id }) => {
  // The script answers this message by renaming Redirect.
  await send(page, "Rename the redirect service to Redirector");
  await expect(page.getByText("Renamed Redirect to Redirector.")).toBeVisible();
  await ready(page);
  await expect(tile(page, "Redirector")).toBeVisible();
  const saved = await design(page, id);
  expect(saved.revision).toBe(2);
  expect(saved.elements.find((e) => e.id === "redirect")?.name).toBe("Redirector");
});

test("adds a tile through chat with the lane commands", async ({ page, tinyurl: id }) => {
  // The script answers this message with an addTile after Redirect, as the canvas's + would.
  await send(page, "Add a cache after the redirect service");
  await expect(page.getByText("Added a cache after the Redirect service")).toBeVisible();
  await ready(page);
  await expect(tiles(page)).toHaveCount(10);
  await expect(lines(page)).toHaveCount(11);
  await expect(tile(page, "Cache")).toBeVisible();
  const saved = await design(page, id);
  expect(saved.revision).toBe(2);
  expect(saved.connections.find((c) => c.to.element === "cache")?.from.element).toBe("redirect");

  // The turn is one undo step (the header's Undo; the turn has its own Undo button too).
  await page.locator(".lane-header-actions").getByRole("button", { name: "Undo" }).click();
  await ready(page);
  await expect(tiles(page)).toHaveCount(9);
});

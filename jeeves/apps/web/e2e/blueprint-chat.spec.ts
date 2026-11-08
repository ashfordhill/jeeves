import type { Page } from "@playwright/test";
import { design, expect, lines, ready, test, tile, tiles } from "./studio.ts";

test("serves the read-only blueprint", async ({ page, tinyurl: id }) => {
  const res = await page.request.get(`/api/projects/${id}/blueprint`);
  expect(res.status()).toBe(200);
  expect(res.headers()["cache-control"]).toBe("no-store");
  const blueprint = await res.json();
  expect(blueprint).toMatchObject({ blueprint: 2, revision: 1, findings: [], omitted: [] });
  // The user's actions, and each entry names its action.
  expect(blueprint.actions).toEqual([
    { lane: "download", name: "Open link" },
    { lane: "upload", name: "Shorten" },
  ]);
  expect(blueprint.entries).toContainEqual({
    lane: "upload",
    action: "Shorten",
    element: "shorten",
  });
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

test("shows pattern lookup and unsupported obligations without changing the design", async ({
  page,
  tinyurl: id,
}) => {
  const before = await (await page.request.get(`/api/projects/${id}/blueprint`)).json();
  await send(page, "Review the processing lifecycle");
  await expect(
    page.getByText("Processing success is not committed publication.", { exact: false }),
  ).toBeVisible();
  await expect(
    page.getByText("Read design pattern Durable background job (1.0.0)", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Read design pattern Committed publication to search (1.0.0)", { exact: true }),
  ).toBeVisible();
  await ready(page);
  await expect(tiles(page)).toHaveCount(11);
  expect(await (await page.request.get(`/api/projects/${id}/blueprint`)).json()).toEqual(before);
});

test("adds a tile through chat with the lane commands", async ({ page, tinyurl: id }) => {
  // The script answers this message with an addTile after Redirect, as the canvas's + would.
  await send(page, "Add a cache after the redirect service");
  await expect(page.getByText("Added a cache after the Redirect service")).toBeVisible();
  await ready(page);
  await expect(tiles(page)).toHaveCount(12);
  await expect(lines(page)).toHaveCount(13);
  await expect(tile(page, "Cache")).toBeVisible();
  const saved = await design(page, id);
  expect(saved.revision).toBe(2);
  expect(saved.connections.find((c) => c.to.element === "cache")?.from.element).toBe("redirect");

  // The turn is one undo step (the header's Undo; the turn has its own Undo button too).
  await page.locator(".lane-header-actions").getByRole("button", { name: "Undo" }).click();
  await ready(page);
  await expect(tiles(page)).toHaveCount(11);
});

test("saves a warned proposal with readable review details and one mouse Undo", async ({
  page,
  tinyurl: id,
}) => {
  const before = await design(page, id);
  await send(page, "Prepare uploads without storage");
  await expect(page.getByText("Review of saved revision 2.", { exact: false })).toBeVisible();
  await expect(
    page.getByText("Unresolved: 1 design finding; 1 requirement not specified", { exact: false }),
  ).toBeVisible();
  // The completed turn replaces the streaming view; open its disclosure after that replacement.
  await expect(page.locator(".chat-turn[aria-busy]")).toHaveCount(0);
  await page.getByText("Review details (3)", { exact: true }).click();
  await expect(
    page
      .locator(".chat-review-details")
      .getByText("Not specified · upload-lifecycle:", { exact: false }),
  ).toBeVisible();
  await expect(
    page.locator(".chat-review-details").getByText("has no storage relationship", { exact: false }),
  ).toBeVisible();
  await ready(page);
  await tile(page, "Uploads").click();
  await expect(
    page.getByLabel("Warnings").getByText("Uploads has no storage relationship", { exact: false }),
  ).toBeVisible();
  const saved = await design(page, id);
  expect(saved.revision).toBe(2);
  expect(saved.elements).toHaveLength(before.elements.length + 1);
  expect(saved.architecture?.studio).not.toHaveProperty("reviewScope");
  await page.locator(".lane-header-actions").getByRole("button", { name: "Undo" }).click();
  await ready(page);
  await expect(tiles(page)).toHaveCount(11);
  const undone = await design(page, id);
  expect({ ...undone, revision: before.revision }).toEqual(before);
});

import { design, expect, ready, test, tile } from "./studio.ts";

test("serves the read-only blueprint", async ({ page, tinyurl: id }) => {
  const res = await page.request.get(`/api/projects/${id}/blueprint`);
  expect(res.status()).toBe(200);
  expect(res.headers()["cache-control"]).toBe("no-store");
  const blueprint = await res.json();
  expect(blueprint).toMatchObject({ blueprint: 1, revision: 1, findings: [], omitted: [] });
  expect(blueprint.services.map((s: { id: string }) => s.id)).toEqual([
    "analytics",
    "redirect",
    "shorten-api",
  ]);
});

test("applies a chat turn from the scripted model as one edit", async ({ page, tinyurl: id }) => {
  const open = page.getByRole("button", { name: "Open chat" });
  if (await open.isVisible()) await open.click();
  // fixtures/chat/e2e-script.json answers this message by renaming Redirect.
  await page.getByLabel("Message").fill("Rename the redirect service to Redirector");
  await page.getByRole("button", { name: "Send", exact: true }).click();
  await expect(page.getByText("Renamed Redirect to Redirector.")).toBeVisible();
  await ready(page);
  await expect(tile(page, "Redirector")).toBeVisible();
  const saved = await design(page, id);
  expect(saved.revision).toBe(2);
  expect(saved.elements.find((e) => e.id === "redirect")?.name).toBe("Redirector");
});

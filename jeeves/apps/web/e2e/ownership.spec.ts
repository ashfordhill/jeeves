import { declareLinks } from "./ownership.ts";
import { expect, ready, test, tile, tiles } from "./studio.ts";

test("declares one owner, preserves canonical resource focus, refuses excess access and undoes exact removal", async ({
  page,
  tinyurl: id,
}) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.getByRole("button", { name: "Collapse chat", exact: true }).click();
  const state = async () =>
    (await (await page.request.get(`/api/projects/${id}/design`)).json()).design;
  const bp = async () =>
    await (await page.request.get(`/api/projects/${id}/blueprint?version=3`)).json();
  const before = await state();
  await declareLinks(page);
  await ready(page);
  const saved = await state();
  expect(saved.elements).toEqual(before.elements);
  expect(saved.connections).toEqual(before.connections);
  await expect(tile(page, "Links · logical owner")).toBeVisible();
  await expect(tiles(page)).toHaveCount(10);
  await tile(page, "Links · logical owner").click();
  await expect(page.getByText("Links · one logical owner", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Open chat", exact: true }).click();
  await page.getByLabel("Message").fill("Inspect this logical owner selection");
  const sent = page.waitForRequest(
    (request) => request.url().endsWith(`/projects/${id}/chat`) && request.method() === "POST",
  );
  await page.getByRole("button", { name: "Send", exact: true }).click();
  expect((await sent).postDataJSON().selection).toEqual(["owner:owner-1"]);
  await expect(
    page.getByText("Selected logical owner retained. No design edits.", { exact: false }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Collapse chat", exact: true }).click();
  expect(await state()).toEqual(saved);
  await page.getByRole("button", { name: "Ownership & access", exact: true }).click();
  const form = page.getByRole("dialog", { name: "Ownership & access" });
  await form.getByRole("tab", { name: "Access", exact: true }).click();
  await form
    .getByLabel("Redirect service to URL cache grant", { exact: true })
    .selectOption("read");
  await form.getByRole("button", { name: "Preview ownership", exact: true }).click();
  await expect(form.getByText(/Ownership refused/)).toBeVisible();
  await expect(form.getByText(/outside its read role grant/)).toBeVisible();
  await expect(form.getByRole("button", { name: "Save ownership", exact: true })).toBeDisabled();
  expect(await state()).toEqual(saved);
  await form.getByRole("button", { name: "Cancel", exact: true }).click();
  const full = await bp();
  await tile(page, "URL database").click();
  await page
    .locator(".studio-inspector")
    .getByRole("button", { name: "Focus relationships", exact: true })
    .click();
  await page.getByRole("button", { name: "Fit focus", exact: true }).click();
  await expect(tile(page, "Links · logical owner")).toBeVisible();
  expect(await bp()).toEqual(full);
  await page
    .locator(".lane-relationship-focus")
    .getByRole("button", { name: /Reads links on a cache miss/ })
    .click();
  await ready(page);
  await expect(tile(page, "Redirect service")).toBeVisible();
  await expect(page.locator('.board .react-flow__edge[data-id="redirect-db"]')).toHaveClass(
    /selected/,
  );
  expect(await bp()).toEqual(full);
  await page
    .locator(".studio-inspector")
    .getByRole("button", { name: "Remove relationship", exact: true })
    .click();
  const removal = page.getByRole("dialog", { name: "Remove relationship declarations" });
  await expect(removal).toContainText("dependencies · redirect-db");
  await removal.getByRole("button", { name: "Remove relationship", exact: true }).click();
  await expect
    .poll(async () =>
      (await state()).ownership.dependencies.some(
        (x: { connection: string }) => x.connection === "redirect-db",
      ),
    )
    .toBe(false);
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect
    .poll(async () => ({ ...(await state()), revision: 0 }))
    .toEqual({ ...saved, revision: 0 });
  await page.getByRole("button", { name: "Show all", exact: true }).click();
  await page.getByRole("button", { name: "Fit", exact: true }).click();
  await page.reload();
  await ready(page);
  await expect(tile(page, "Links · logical owner")).toBeVisible();
  await tile(page, "Links · logical owner")
    .getByRole("button", { name: "Expand roles", exact: true })
    .click();
  await ready(page);
  await expect(tile(page, "Shorten service")).toBeVisible();
  await page.getByRole("button", { name: "Collapse Links", exact: true }).click();
  await ready(page);
  expect({ ...(await bp()), revision: 0 }).toEqual({ ...full, revision: 0 });
});

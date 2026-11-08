import { alignResolveSettings, declareResolve } from "./operations.ts";
import { declareLinks } from "./ownership.ts";
import { expect, ready, test, tile } from "./studio.ts";

test("declares public resolve by mouse, retains exact policy refs after reload and removes/undoes its cache bindings", async ({
  page,
  tinyurl: id,
}) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.getByRole("button", { name: "Collapse chat", exact: true }).click();
  const state = async () =>
    (await (await page.request.get(`/api/projects/${id}/design`)).json()).design;
  await declareLinks(page);
  await alignResolveSettings(page);
  await declareResolve(page);
  const saved = await state();
  expect(saved.operations.receivers[0].binding).toMatchObject({
    kind: "resolve-link",
    storeConnection: "redirect-db",
    cacheConnection: "redirect-cache",
    cachePolicy: { id: "links-positive-cache", version: "1.0.0" },
  });
  await expect(
    tile(page, "Redirect service").getByText("Resolve link · v1", { exact: true }),
  ).toBeVisible();
  await page.reload();
  await ready(page);
  await tile(page, "Links · logical owner")
    .getByRole("button", { name: "Expand roles", exact: true })
    .click();
  await ready(page);
  await tile(page, "Redirect service").click();
  await page.getByRole("button", { name: "Details & bindings", exact: true }).click();
  const form = page.getByRole("dialog", { name: "Operation contracts" });
  await expect(
    form.getByLabel("operation-1 pinned positive cache policy", { exact: true }),
  ).toBeChecked();
  await form.getByText("Cache policy exact reference · operation-1", { exact: true }).click();
  await expect(form.getByLabel("operation-1 cache policy id", { exact: true })).toHaveValue(
    "links-positive-cache",
  );
  await form.getByRole("button", { name: "Cancel", exact: true }).click();
  await tile(page, "URL cache").click();
  await tile(page, "URL cache")
    .getByRole("button", { name: "Remove URL cache", exact: true })
    .click();
  const removal = page.getByRole("dialog", { name: "Remove URL cache" });
  await expect(removal).toContainText("2 affected operation bindings");
  await expect(removal).toContainText("Clear Resolve link · v1");
  await removal.getByRole("button", { name: "Remove 1 tiles", exact: true }).click();
  await expect.poll(async () => (await state()).operations.receivers.length).toBe(0);
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect
    .poll(async () => ({ ...(await state()), revision: 0 }))
    .toEqual({ ...saved, revision: 0 });
});

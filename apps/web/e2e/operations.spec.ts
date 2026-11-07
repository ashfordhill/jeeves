import { alignCreateTimeout, declareCreate } from "./operations.ts";
import { declareLinks } from "./ownership.ts";
import { expect, ready, test, tile } from "./studio.ts";

test("declares a named operation on the canonical API, previews precise clears and restores it with one Undo", async ({
  page,
  tinyurl: id,
}) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.getByRole("button", { name: "Collapse chat", exact: true }).click();
  const state = async () =>
      (await (await page.request.get(`/api/projects/${id}/design`)).json()).design,
    bp = async () =>
      await (await page.request.get(`/api/projects/${id}/blueprint?version=3`)).json();
  await declareLinks(page);
  await alignCreateTimeout(page);
  await declareCreate(page);
  const saved = await state();
  expect(saved.operations.receivers).toHaveLength(1);
  expect(saved.operations.calls[0]).toMatchObject({
    receiverBinding: "operation-1",
    receiverRole: "shorten",
    caller: { entry: "upload-shorten", lane: "upload", element: "shorten" },
  });
  await expect(
    tile(page, "Shorten service").getByText("Create link · v1", { exact: true }),
  ).toBeVisible();
  const full = await bp();
  await page.getByRole("button", { name: "Details & bindings", exact: true }).click();
  const form = page.getByRole("dialog", { name: "Operation contracts" });
  await form.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(page.getByText("Selected operation for chat · operation-1")).toBeVisible();
  expect(await bp()).toEqual(full);
  await page.getByRole("button", { name: "Focus relationships", exact: true }).click();
  await page.getByRole("button", { name: "Fit focus", exact: true }).click();
  expect(await bp()).toEqual(full);
  await page.getByRole("button", { name: "Show all", exact: true }).click();
  await page.getByRole("button", { name: "Fit", exact: true }).click();
  await page.getByRole("button", { name: "Ownership & access", exact: true }).click();
  const ownership = page.getByRole("dialog", { name: "Ownership & access" });
  await ownership.getByRole("button", { name: "Remove owner Links", exact: true }).click();
  await ownership.getByRole("button", { name: "Preview ownership", exact: true }).click();
  await expect(ownership.getByText("2 affected operation bindings")).toBeVisible();
  await expect(
    ownership.getByText(/Clear Create link · v1 implementation on Shorten service/),
  ).toBeVisible();
  await ownership.getByRole("button", { name: "Cancel", exact: true }).click();
  expect(await state()).toEqual(saved);
  await page.reload();
  await ready(page);
  await tile(page, "Links · logical owner")
    .getByRole("button", { name: "Expand roles", exact: true })
    .click();
  await ready(page);
  await tile(page, "Shorten service").click();
  await tile(page, "Shorten service")
    .getByRole("button", { name: "Remove Shorten service", exact: true })
    .click();
  const removal = page.getByRole("dialog", { name: "Remove Shorten service" });
  await expect(removal).toContainText("2 affected operation bindings");
  await removal.getByRole("button", { name: "Remove 1 tiles", exact: true }).click();
  await expect.poll(async () => (await state()).operations.receivers.length).toBe(0);
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect
    .poll(async () => ({ ...(await state()), revision: 0 }))
    .toEqual({ ...saved, revision: 0 });
});

test("edits and clears an unresolved exact verifier, then previews an entry move and undoes it once", async ({
  page,
  tinyurl: id,
}) => {
  await page.getByRole("button", { name: "Collapse chat", exact: true }).click();
  await declareLinks(page);
  await alignCreateTimeout(page);
  await declareCreate(page);
  const state = async () =>
    (await (await page.request.get(`/api/projects/${id}/design`)).json()).design;
  const open = async () => {
    await page.getByRole("button", { name: "Operation contracts", exact: true }).click();
    return page.getByRole("dialog", { name: "Operation contracts" });
  };
  let form = await open();
  await form.getByText("Auth verifier reference · unavailable", { exact: true }).click();
  await form
    .getByRole("button", { name: "Declare unresolved verifier reference operation-1", exact: true })
    .click();
  await form.getByLabel("operation-1 verifier id", { exact: true }).fill("future-verifier");
  await form.getByLabel("operation-1 verifier version", { exact: true }).fill("1.0.0");
  await form.getByLabel("operation-1 verifier sha256", { exact: true }).fill("f".repeat(64));
  await form.getByRole("button", { name: "Preview operations", exact: true }).click();
  await expect(form.getByText(/Runtime auth verifier future-verifier@1.0.0/)).toBeVisible();
  await form.getByRole("button", { name: "Save operations", exact: true }).click();
  await expect(form).toBeHidden();
  await page.reload();
  await ready(page);
  expect((await state()).operations.receivers[0].binding.authVerifier).toEqual({
    id: "future-verifier",
    version: "1.0.0",
    sha256: "f".repeat(64),
  });
  form = await open();
  await form.getByText("Auth verifier reference · unavailable", { exact: true }).click();
  await expect(form.getByLabel("operation-1 verifier id", { exact: true })).toHaveValue(
    "future-verifier",
  );
  await form
    .getByRole("button", { name: "Clear verifier reference operation-1", exact: true })
    .click();
  await form.getByRole("button", { name: "Preview operations", exact: true }).click();
  await form.getByRole("button", { name: "Save operations", exact: true }).click();
  await expect(form).toBeHidden();
  expect((await state()).operations.receivers[0].binding.authVerifier).toBeNull();
  await tile(page, "Stats API").click();
  await tile(page, "Stats API")
    .getByRole("button", { name: "Remove Stats API", exact: true })
    .click();
  await expect(tile(page, "Stats API")).toHaveCount(0);
  const owner = tile(page, "Links · logical owner");
  if (await owner.isVisible())
    await owner.getByRole("button", { name: "Expand roles", exact: true }).click();
  await ready(page);
  await tile(page, "Shorten service").click();
  const before = await state();
  await page.getByRole("button", { name: "Focus relationships", exact: true }).click();
  await page
    .locator(".lane-relationship-focus")
    .getByRole("button", { name: /Shorten → Shorten service/ })
    .click();
  await page.getByRole("button", { name: "Download lane", exact: true }).click();
  const move = page.getByRole("dialog", { name: "Move entry operation bindings" });
  await expect(move).toContainText("clears 1 operation bindings");
  await expect(move).toContainText("Clear upload entry upload-shorten");
  expect(await state()).toEqual(before);
  await move.getByRole("button", { name: "Move entry & clear bindings", exact: true }).click();
  await expect(move).toBeHidden();
  await expect.poll(async () => (await state()).operations.calls.length).toBe(0);
  expect((await state()).operations.receivers).toEqual(before.operations.receivers);
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect
    .poll(async () => ({ ...(await state()), revision: 0 }))
    .toEqual({ ...before, revision: 0 });
});

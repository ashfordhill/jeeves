import {
  buildOperationsCommand,
  cleanOwnershipChange,
  designOperations,
  designOwnership,
  previewOperations,
  previewOwnership,
} from "@jeeves/spec";
import { alignCreateTimeout, declareCreate } from "./operations.ts";
import { declareLinks } from "./ownership.ts";
import { commitSource, openDiagnostics, selectOperation } from "./source.ts";
import { expect, ready, test, tile } from "./studio.ts";

test("preserves a source operation on the canonical API, previews precise clears and restores it with one Undo", async ({
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
  await expect(tile(page, "Shorten service")).toBeVisible();
  await expect(tile(page, "Shorten service")).not.toContainText("role");
  const full = await bp();
  await selectOperation(page, "operation-1");
  await expect(page.getByText("Selected operation for chat · operation-1")).toBeVisible();
  expect(await bp()).toEqual(full);
  await page.getByRole("button", { name: "Focus relationships", exact: true }).click();
  await page.getByRole("button", { name: "Fit focus", exact: true }).click();
  expect(await bp()).toEqual(full);
  await page.getByRole("button", { name: "Show all", exact: true }).click();
  await page.getByRole("button", { name: "Fit", exact: true }).click();
  const removed = structuredClone(designOwnership(saved));
  removed.owners = [];
  const preview = previewOwnership(saved, cleanOwnershipChange(saved, removed));
  expect(preview.operationChanges).toHaveLength(2);
  expect(preview.operationChanges[0]?.change).toBe("removed");
  expect(await state()).toEqual(saved);
  await page.reload();
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

test("preserves and clears an unresolved source verifier, then previews an entry move and undoes it once", async ({
  page,
  tinyurl: id,
}) => {
  await page.getByRole("button", { name: "Collapse chat", exact: true }).click();
  await declareLinks(page);
  await alignCreateTimeout(page);
  await declareCreate(page);
  const state = async () =>
    (await (await page.request.get(`/api/projects/${id}/design`)).json()).design;
  await commitSource(page, (design) => {
    const operations = structuredClone(designOperations(design));
    const binding = operations.receivers[0]?.binding;
    if (binding?.kind !== "create-link") throw new Error("Missing create operation");
    binding.authVerifier = { id: "future-verifier", version: "1.0.0", sha256: "f".repeat(64) };
    expect(
      previewOperations(design, operations)
        .findings.map((row) => row.message)
        .join(" "),
    ).toContain("Runtime auth verifier future-verifier@1.0.0");
    return buildOperationsCommand(design, { operations });
  });
  expect((await state()).operations.receivers[0].binding.authVerifier).toEqual({
    id: "future-verifier",
    version: "1.0.0",
    sha256: "f".repeat(64),
  });
  const diagnostics = await openDiagnostics(page);
  await diagnostics.getByText(/^Operation declarations ·/).click();
  await expect(diagnostics.locator(".operation-summary")).toContainText("future-verifier");
  await page.getByRole("button", { name: "Close source & diagnostics", exact: true }).click();
  await commitSource(page, (design) => {
    const operations = structuredClone(designOperations(design));
    const binding = operations.receivers[0]?.binding;
    if (binding?.kind !== "create-link") throw new Error("Missing create operation");
    binding.authVerifier = null;
    return buildOperationsCommand(design, { operations });
  });
  expect((await state()).operations.receivers[0].binding.authVerifier).toBeNull();
  await tile(page, "Stats API").click();
  await tile(page, "Stats API")
    .getByRole("button", { name: "Remove Stats API", exact: true })
    .click();
  await expect(tile(page, "Stats API")).toHaveCount(0);
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

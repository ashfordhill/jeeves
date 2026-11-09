import { buildOwnershipCommand, designOwnership, previewOwnership } from "@jeeves/spec";
import { declareLinks } from "./ownership.ts";
import { openDiagnostics } from "./source.ts";
import { clickLine, expect, ready, test, tile, tiles } from "./studio.ts";

test("preserves one source owner, keeps canonical resource selection, refuses excess access and undoes exact removal", async ({
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
  await expect(tile(page, "Shorten service")).toBeVisible();
  await expect(tile(page, "Redirect service")).toBeVisible();
  await expect(tiles(page)).toHaveCount(11);
  const diagnostics = await openDiagnostics(page);
  await diagnostics.getByText(/^Ownership & access ·/).click();
  await diagnostics.getByRole("button", { name: "Select owner owner-1", exact: true }).click();
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
  const invalid = structuredClone(designOwnership(saved));
  invalid.grants = invalid.grants.map((row) =>
    row.role === "redirect" && row.resource === "url-cache" ? { ...row, access: "read" } : row,
  );
  const preview = previewOwnership(saved, invalid);
  expect(preview.canApply).toBe(false);
  expect(preview.findings.map((row) => row.message).join(" ")).toContain(
    "outside its read role grant",
  );
  const refused = await page.request.post(`/api/projects/${id}/operations`, {
    data: {
      baseRevision: saved.revision,
      ops: buildOwnershipCommand(saved, { ownership: invalid }).ops,
    },
  });
  expect(refused.ok()).toBe(false);
  expect(await state()).toEqual(saved);
  const full = await bp();
  await tile(page, "URL database").click();
  await expect(tile(page, "URL database")).toHaveClass(/selected/);
  await expect(tile(page, "Shorten service")).toBeVisible();
  expect(await bp()).toEqual(full);
  await clickLine(page, "redirect-db");
  await expect(page.locator(".studio-inspector .lane-connection-label")).toHaveText(
    "Reads links on a cache miss",
  );
  await expect(tile(page, "Redirect service")).toBeVisible();
  expect(await bp()).toEqual(full);
  await page
    .getByRole("button", { name: "Remove Redirect service to URL database", exact: true })
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
  await page.getByRole("button", { name: "Fit", exact: true }).click();
  await page.reload();
  await ready(page);
  await expect(tile(page, "Shorten service")).toBeVisible();
  await expect(tile(page, "Shorten service")).toBeVisible();
  await expect(page.getByRole("button", { name: "Expand roles", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Ownership & access", exact: true })).toHaveCount(
    0,
  );
  expect({ ...(await bp()), revision: 0 }).toEqual({ ...full, revision: 0 });
});

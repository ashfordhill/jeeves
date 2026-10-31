import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "./browser-test.ts";
import { layoutOf } from "./helpers.ts";

test("reviews an editable starter upgrade by mouse and retains application identities, layout and undo history", async ({
  page,
  request,
}) => {
  const response = await request.post("/api/projects/from-starter", {
    data: { name: "Upgrade Fieldwork", starter: { id: "resource-workspace", version: "0.1.0" } },
  });
  expect(response.status()).toBe(201);
  const id = (await response.json()).project.id;
  await page.goto(`/?project=${id}#/draw`);
  const read = async () => (await (await request.get(`/api/projects/${id}/design`)).json()).design;
  await expect(page.locator('[data-element-id="inventory"]')).toBeVisible();
  const before = await read(),
    layout = await layoutOf(request, id);
  const card = page.locator('[data-element-id="inventory"]');
  await card.locator(".element-card-head").click();
  await card.getByLabel("Subtype of Inventory API").selectOption("http-service@0.3.0");
  let dialog = page.getByRole("dialog", { name: "Review template upgrade" });
  await expect(dialog.getByText("Local execution policy", { exact: true })).toBeVisible();
  await dialog.getByText("Retained identities and configuration").click();
  await expect(dialog.getByText(/Attachments: inventory-api/)).toBeVisible();
  await expect(dialog.getByText(/Connections: inventory-store, inventory-call/)).toBeVisible();
  expect((await new AxeBuilder({ page }).include('[role="dialog"]').analyze()).violations).toEqual(
    [],
  );
  await page.screenshot({ path: "test-results/p29-upgrade-review.png", animations: "disabled" });
  await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
  expect(await read()).toEqual(before);
  await card.getByLabel("Subtype of Inventory API").selectOption("http-service@0.3.0");
  dialog = page.getByRole("dialog", { name: "Review template upgrade" });
  await dialog.getByRole("button", { name: "Upgrade template", exact: true }).click();
  await expect(dialog).not.toBeVisible();
  const expected = structuredClone(before);
  expected.revision++;
  expected.elements.find((item: { id: string }) => item.id === "inventory").template.version =
    "0.3.0";
  expect(await read()).toEqual(expected);
  expect(await layoutOf(request, id)).toEqual(layout);
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect.poll(async () => (await read()).elements[0].template.version).toBe("0.2.0");
  await page.getByRole("button", { name: "Redo", exact: true }).click();
  await page.reload();
  await card.locator(".element-card-head").click();
  await expect(card.getByLabel("Subtype of Inventory API")).toHaveValue("http-service@0.3.0");
  await page.getByRole("button", { name: "Add attachment", exact: true }).click();
  await page.getByRole("menuitem", { name: "Local execution policy", exact: true }).click();
  await page.getByRole("button", { name: "Configure local execution", exact: true }).click();
  const policy = page.getByRole("dialog", { name: "Configure local execution" });
  await policy.getByRole("button", { name: "Save local execution" }).click();
  await expect(policy).not.toBeVisible();
  const changed = await read();
  expect(changed.elements[0].attachments[0]).toEqual(before.elements[0].attachments[0]);
  expect(changed.connections).toEqual(before.connections);
  expect(changed.startedFrom).toEqual(before.startedFrom);
  await page.getByRole("button", { name: "Architecture", exact: true }).click();
  const workspace = page.getByRole("region", { name: "Architecture workspace", exact: true });
  await workspace
    .getByRole("navigation", { name: "Architecture levels" })
    .getByRole("button", { name: /Containers/ })
    .click();
  await workspace.getByLabel("Inspect an object").selectOption("container:inventory");
  await expect(workspace.getByRole("region", { name: "Local execution policy" })).toContainText(
    "balanced",
  );
  await page.screenshot({ path: "test-results/p29-upgraded-c4.png", animations: "disabled" });
});

test("refuses stale, reverse and protected recipe upgrade reviews without discarding the application", async ({
  page,
  request,
  browserProblems,
}) => {
  const response = await request.post("/api/projects/from-starter", {
    data: { name: "Review boundaries", starter: { id: "resource-workspace", version: "0.1.0" } },
  });
  expect(response.status()).toBe(201);
  const id = (await response.json()).project.id;
  await page.goto(`/?project=${id}#/draw`);
  const read = async () => (await (await request.get(`/api/projects/${id}/design`)).json()).design;
  const before = await read();
  const card = page.locator('[data-element-id="inventory"]');
  await card.locator(".element-card-head").click();
  await card.getByLabel("Subtype of Inventory API").selectOption("http-service@0.1.0");
  let dialog = page.getByRole("dialog", { name: "Review template upgrade" });
  await expect(dialog.getByRole("alert")).toContainText("No reviewed compatible upgrade");
  await expect(dialog.getByRole("button", { name: "Upgrade template" })).toBeDisabled();
  await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
  expect(await read()).toEqual(before);
  await page.getByRole("button", { name: "Dark mode", exact: true }).click();
  await card.getByLabel("Subtype of Inventory API").selectOption("http-service@0.3.0");
  dialog = page.getByRole("dialog", { name: "Review template upgrade" });
  await page.setViewportSize({ width: 680, height: 740 });
  await expect(dialog.getByRole("button", { name: "Upgrade template" })).toBeInViewport();
  expect((await new AxeBuilder({ page }).include('[role="dialog"]').analyze()).violations).toEqual(
    [],
  );
  await page.screenshot({
    path: "test-results/p29-upgrade-narrow-dark.png",
    animations: "disabled",
  });
  expect(
    (
      await request.post(`/api/projects/${id}/operations`, {
        data: {
          baseRevision: before.revision,
          ops: [{ op: "updateElement", id: "inventory", name: "Updated Inventory API" }],
        },
      })
    ).status(),
  ).toBe(200);
  const expectedError = browserProblems.expectHttp({
    scenario: "stale template upgrade review",
    method: "POST",
    url: new URL(`/api/projects/${id}/operations`, page.url()).href,
    resourceType: "fetch",
    status: 409,
  });
  await dialog.getByRole("button", { name: "Upgrade template" }).click();
  await expect(dialog.getByRole("alert").filter({ hasText: "board was reloaded" })).toBeVisible();
  expectedError.finish();
  await dialog.getByRole("button", { name: "Upgrade template" }).click();
  await expect(dialog.getByText(/design changed while this review was open/)).toBeVisible();
  await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
  expect((await read()).elements[0].template.version).toBe("0.2.0");
  expect((await read()).elements[0].attachments).toEqual(before.elements[0].attachments);
  const recipe = await request.post("/api/projects/from-recipe", {
    data: { name: "Protected QR release", recipe: { id: "qr-studio", version: "0.1.0" } },
  });
  expect(recipe.status()).toBe(201);
  const recipeId = (await recipe.json()).project.id;
  const recipeBefore = await (await request.get(`/api/projects/${recipeId}/design`)).json();
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(`/?project=${recipeId}#/draw`);
  const qr = page.locator('[data-element-id="qrwty"]');
  await qr.locator(".element-card-head").click();
  await qr.getByLabel("Subtype of qrwty API", { exact: true }).selectOption("http-service@0.3.0");
  dialog = page.getByRole("dialog", { name: "Review template upgrade" });
  await expect(dialog.getByRole("alert")).toContainText("protected recipe release");
  await expect(dialog.getByRole("button", { name: "Upgrade template" })).toBeDisabled();
  expect((await new AxeBuilder({ page }).include('[role="dialog"]').analyze()).violations).toEqual(
    [],
  );
  await page.screenshot({ path: "test-results/p29-protected-recipe.png", animations: "disabled" });
  await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
  expect((await (await request.get(`/api/projects/${recipeId}/design`)).json()).design).toEqual(
    recipeBefore.design,
  );
});

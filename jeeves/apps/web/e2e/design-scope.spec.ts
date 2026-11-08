import { expect, ready, test } from "./studio.ts";

test("previews an explicit scope upgrade, retains blocked requirements on reload and undoes the boundary", async ({
  page,
  tinyurl: id,
}) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  const state = async () =>
    (await (await page.request.get(`/api/projects/${id}/design`)).json()).design;
  const before = await state();
  await page.getByRole("button", { name: "Profile & requirements", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Profile & requirements" });
  await dialog.getByLabel("Behavior profile", { exact: true }).selectOption("tinyurl");
  await dialog.getByLabel("Custom slugs scope", { exact: true }).selectOption("included");
  await dialog.getByText("Unresolved custom requirements (0/8)", { exact: true }).click();
  await dialog.getByRole("button", { name: "Add custom requirement", exact: true }).click();
  await dialog
    .getByLabel("Custom requirement 1", { exact: true })
    .fill("Define tenant destination policy");
  await dialog.getByLabel("Custom requirement 1 tile", { exact: true }).selectOption("shorten");
  const upgrade = dialog.getByRole("button", { name: "Upgrade & save requirements", exact: true });
  await expect(upgrade).toBeDisabled();
  await dialog.getByRole("button", { name: "Preview requirements", exact: true }).click();
  await expect(dialog.getByText("Explicit upgrade: schema v2 → v3", { exact: true })).toBeVisible();
  await expect(dialog.getByText(/This required behavior blocks the narrow profile/)).toBeVisible();
  expect(await state()).toEqual(before);
  await upgrade.click();
  await expect(dialog).toBeHidden();
  const saved = await state();
  expect(saved).toMatchObject({
    schemaVersion: 3,
    revision: before.revision + 1,
    scope: {
      customRequirements: [{ requirement: "Define tenant destination policy", element: "shorten" }],
    },
  });
  expect((await page.request.get(`/api/projects/${id}/blueprint`)).status()).toBe(422);
  const v3 = await (await page.request.get(`/api/projects/${id}/blueprint?version=3`)).json();
  expect(v3).toMatchObject({
    blueprint: 3,
    scope: { ...saved.scope, requirements: expect.arrayContaining(saved.scope.requirements) },
    runtimeVerification: "none",
  });
  await page.reload();
  await ready(page);
  await page.getByRole("button", { name: "Profile & requirements", exact: true }).click();
  await expect(dialog.getByLabel("Custom slugs scope", { exact: true })).toHaveValue("included");
  await expect(dialog.getByLabel("Custom requirement 1", { exact: true })).toHaveValue(
    "Define tenant destination policy",
  );
  await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect.poll(state).toEqual({ ...before, revision: saved.revision + 1 });
  expect((await page.request.get(`/api/projects/${id}/blueprint`)).ok()).toBe(true);
});

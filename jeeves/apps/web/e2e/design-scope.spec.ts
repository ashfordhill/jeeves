import { buildDesignScopeCommand, previewDesignScope, tinyurlDesignScope } from "@jeeves/spec";
import { commitSource, openDiagnostics } from "./source.ts";
import { expect, ready, test } from "./studio.ts";

test("retains blocked historical requirements in read-only diagnostics, source export and Undo", async ({
  page,
  tinyurl: id,
}) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  const state = async () =>
    (await (await page.request.get(`/api/projects/${id}/design`)).json()).design;
  const before = await state();
  const scope = tinyurlDesignScope();
  scope.requirements = scope.requirements.map((row) =>
    row.feature === "custom-slugs" ? { ...row, disposition: "included" } : row,
  );
  scope.customRequirements = [
    {
      id: "custom-1",
      requirement: "Define tenant destination policy",
      criticality: "required",
      element: "shorten",
    },
  ];
  expect(
    previewDesignScope(before, scope)
      .unresolved.map((row) => row.requirement)
      .join(" "),
  ).toContain("This required behavior blocks the narrow profile");
  await commitSource(page, (design) => buildDesignScopeCommand(design, { scope, upgrade: true }));
  const saved = await state();
  expect(saved).toMatchObject({ schemaVersion: 3, revision: before.revision + 1, scope });
  expect((await page.request.get(`/api/projects/${id}/blueprint`)).status()).toBe(422);
  const v3 = await (await page.request.get(`/api/projects/${id}/blueprint?version=3`)).json();
  expect(v3).toMatchObject({
    blueprint: 3,
    scope: { ...saved.scope, requirements: expect.arrayContaining(saved.scope.requirements) },
    runtimeVerification: "none",
  });
  await page.reload();
  await ready(page);
  await expect(
    page.getByRole("button", { name: "Profile & requirements", exact: true }),
  ).toHaveCount(0);
  const dialog = await openDiagnostics(page);
  await dialog.getByText("Profile & requirements", { exact: true }).click();
  await expect(dialog).toContainText("Define tenant destination policy");
  await expect(dialog.locator("input, select, textarea")).toHaveCount(0);
  const download = page.waitForEvent("download");
  await dialog.getByRole("button", { name: "Download source JSON", exact: true }).click();
  const path = await (await download).path();
  if (!path) throw new Error("Missing source download");
  const { readFile } = await import("node:fs/promises");
  expect(JSON.parse(await readFile(path, "utf8"))).toEqual(saved);
  await page.getByRole("button", { name: "Close source & diagnostics", exact: true }).click();
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect.poll(state).toEqual({ ...before, revision: saved.revision + 1 });
  expect((await page.request.get(`/api/projects/${id}/blueprint`)).ok()).toBe(true);
});

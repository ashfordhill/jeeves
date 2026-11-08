import { narrowReadinessSeedOps } from "../../../packages/spec/src/fixtures/nc05-narrow.ts";
import { createStudy, expect, ready, test } from "./studio.ts";

test("the mouse report separates complete contracts from missing implementation/evidence and targets one canonical operation", async ({
  page,
}) => {
  const id = await createStudy(page, "E2E NC05 report", "blank");
  try {
    expect(
      (
        await page.request.post(`/api/projects/${id}/operations`, {
          data: { baseRevision: 0, ops: narrowReadinessSeedOps() },
        })
      ).ok(),
    ).toBe(true);
    await page.reload();
    await ready(page);
    const before = await (await page.request.get(`/api/projects/${id}/blueprint?version=3`)).json();
    const open = page.getByRole("button", { name: "Open inspector", exact: true });
    if (await open.isVisible()) await open.click();
    await page.getByText("Compatibility report", { exact: true }).click();
    const report = page.locator(".readiness-report");
    await expect(report).toHaveAttribute(
      "data-composition-sha256",
      before.readiness.composition.sha256,
    );
    await expect(report.getByLabel("Compatibility stages")).toContainText("valid");
    await expect(report.getByLabel("Compatibility stages")).toContainText("complete");
    await expect(report.getByLabel("Compatibility stages")).toContainText("unavailable");
    await expect(report.getByLabel("Compatibility stages")).toContainText("none");
    await report.getByText("Implementation availability · 2 blockers", { exact: true }).click();
    await report.getByRole("button", { name: "Select operation create-link", exact: true }).click();
    await expect(
      page.getByText("Selected operation for chat · create-link", { exact: true }),
    ).toBeVisible();
    await ready(page);
    await page.getByRole("button", { name: "Fit", exact: true }).click();
    expect(
      await (await page.request.get(`/api/projects/${id}/blueprint?version=3`)).json(),
    ).toEqual(before);
    await page.reload();
    await ready(page);
    expect(
      await (await page.request.get(`/api/projects/${id}/blueprint?version=3`)).json(),
    ).toEqual(before);
  } finally {
    await page.request.delete(`/api/projects/${id}`);
  }
});

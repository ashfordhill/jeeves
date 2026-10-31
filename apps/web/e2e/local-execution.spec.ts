import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "./browser-test.ts";
import { openNewProject } from "./helpers.ts";

test("local execution presets edit by mouse and appear as container policy with cancel, undo and reload", async ({
  page,
  request,
}) => {
  const id = await openNewProject(page, request, "Local execution policy");
  await page.getByRole("button", { name: "Elements", exact: true }).click();
  await page.getByRole("button", { name: /^HTTP service/ }).click();
  await page.locator(".react-flow__pane").click({ position: { x: 350, y: 250 } });
  await page.getByRole("article", { name: "HTTP service, HTTP service", exact: true }).click();
  await page.getByRole("button", { name: "Add attachment", exact: true }).click();
  await page.getByRole("menuitem", { name: "Local execution policy", exact: true }).click();
  const read = async () => (await (await request.get(`/api/projects/${id}/design`)).json()).design;
  await expect.poll(async () => (await read()).elements[0].attachments.length).toBe(1);
  const before = await read();
  expect(before.elements[0].template.version).toBe("0.4.0");
  await page.getByRole("button", { name: "Configure local execution", exact: true }).click();
  let dialog = page.getByRole("dialog", { name: "Configure local execution" });
  await expect(dialog.getByLabel("Execution preset")).toHaveValue("balanced");
  await dialog.getByLabel("Execution preset").selectOption("compact");
  await expect(dialog.getByRole("status")).toContainText(
    "0.5 CPU · 512 MiB memory · 128 processes",
  );
  await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
  expect(await read()).toEqual(before);
  await page.getByRole("button", { name: "Configure local execution", exact: true }).click();
  dialog = page.getByRole("dialog", { name: "Configure local execution" });
  await dialog.getByLabel("Execution preset").selectOption("expanded");
  await expect(dialog.getByRole("status")).toContainText("2 CPU · 1536 MiB memory · 256 processes");
  expect((await new AxeBuilder({ page }).include('[role="dialog"]').analyze()).violations).toEqual(
    [],
  );
  const dialogBox = await dialog.boundingBox();
  expect(dialogBox!.width).toBeLessThan(800);
  const saveBox = await dialog.getByRole("button", { name: "Save local execution" }).boundingBox();
  expect(dialogBox!.y + dialogBox!.height - saveBox!.y - saveBox!.height).toBeLessThan(24);
  await page.screenshot({ path: "test-results/p28-policy.png", animations: "disabled" });
  await dialog.getByRole("button", { name: "Save local execution" }).click();
  await expect(dialog).not.toBeVisible();
  await expect
    .poll(async () => (await read()).elements[0].attachments[0].config.preset)
    .toBe("expanded");
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect
    .poll(async () => (await read()).elements[0].attachments[0].config)
    .toEqual(before.elements[0].attachments[0].config);
  await page.getByRole("button", { name: "Redo", exact: true }).click();
  await page.reload();
  await page.getByRole("article", { name: "HTTP service, HTTP service", exact: true }).click();
  await page.getByRole("button", { name: "Configure local execution", exact: true }).click();
  await expect(dialog.getByLabel("Execution preset")).toHaveValue("expanded");
  await page.setViewportSize({ width: 700, height: 650 });
  expect(await dialog.evaluate((node) => node.scrollWidth <= node.clientWidth + 1)).toBe(true);
  await expect(dialog.getByRole("button", { name: "Save local execution" })).toBeInViewport();
  await page.screenshot({ path: "test-results/p28-policy-narrow.png", animations: "disabled" });
  await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.getByRole("button", { name: "Architecture", exact: true }).click();
  const workspace = page.getByRole("region", { name: "Architecture workspace", exact: true });
  await workspace
    .getByRole("navigation", { name: "Architecture levels" })
    .getByRole("button", { name: /Containers/ })
    .click();
  const details = workspace.getByRole("complementary", { name: "Architecture details" });
  await expect(details.getByRole("region", { name: "Local execution policy" })).toContainText(
    "1536 MiB",
  );
  await details.getByRole("button", { name: "Open components" }).click();
  await expect(details.getByRole("region", { name: "Local execution policy" })).toContainText(
    "expanded",
  );
  const architecture = await (await request.get(`/api/projects/${id}/architecture`)).json();
  expect(
    architecture.views.components[0].nodes.some(
      (n: { binding?: { attachment?: string } }) =>
        n.binding?.attachment === before.elements[0].attachments[0].id,
    ),
  ).toBe(false);
  expect(
    (await new AxeBuilder({ page }).include(".architecture-workspace").analyze()).violations,
  ).toEqual([]);
  await page.screenshot({ path: "test-results/p28-c4-policy.png", animations: "disabled" });
});

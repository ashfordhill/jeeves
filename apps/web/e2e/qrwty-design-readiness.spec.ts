import AxeBuilder from "@axe-core/playwright";
import {
  architectureProof,
  type DesignDocument,
  proofSteps,
  reviewArchitecture,
  scenarioReview,
} from "@jeeves/spec";
import type { Page } from "@playwright/test";
import { expect, test } from "./browser-test.ts";
import { diagramAction, editorAction, openNewProject } from "./helpers.ts";

test.use({ actionTimeout: 10_000 });
const workshop = (page: Page) =>
  page.getByRole("dialog", { name: "Architecture proof workshop", exact: true });
async function openWorkshop(page: Page) {
  await page.getByRole("button", { name: "Library", exact: true }).click();
  await page.getByRole("button", { name: "Build a study step by step", exact: true }).click();
  await expect(workshop(page)).toBeVisible();
}
async function capture(page: Page, name: string, scope = ".integrated-editor") {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect((await new AxeBuilder({ page }).include(scope).analyze()).violations).toEqual([]);
  await page.screenshot({ path: `test-results/p56-${name}.png`, animations: "disabled" });
}

for (const product of ["qrwty", "inventory"] as const) {
  test(`P56 ${product} assembles from small hosts by mouse and retains contracts, paths, review and semantic history`, async ({
    page,
    request,
  }) => {
    test.setTimeout(90_000);
    const id = await openNewProject(page, request, `P56 mouse ${product}`);
    const read = async (): Promise<DesignDocument> =>
      (await (await request.get(`/api/projects/${id}/design`)).json()).design;
    try {
      for (const stage of proofSteps(product)) {
        await openWorkshop(page);
        const dialog = workshop(page);
        if (stage.id === "start")
          await dialog.getByLabel("Study", { exact: true }).selectOption(product);
        await expect(dialog.getByRole("heading", { name: stage.name, exact: true })).toBeVisible();
        if (stage.id === "start")
          await expect(dialog).toContainText(
            product === "qrwty" ? "Preview: 4 logical blocks" : "Preview: 3 logical blocks",
          );
        if (stage.id === "behavior") {
          await dialog
            .getByText("Decisions, consequences and unresolved objectives", { exact: true })
            .scrollIntoViewIfNeeded();
          await expect(dialog).toContainText("Production workload, SLO and recovery remain open");
          await capture(page, `${product}-decision-preview-light`, '[role="dialog"]');
        }
        await dialog.getByRole("button", { name: "Apply reviewed stage", exact: true }).click();
        await expect(dialog).not.toBeVisible();
      }
      const saved = await read();
      expect(saved.architecture).toEqual(architectureProof(product).design.architecture);
      expect(reviewArchitecture(saved).complete).toBe(false);
      expect(reviewArchitecture(saved).unresolvedDecisions).toEqual(["production-objectives"]);
      for (const s of saved.architecture!.scenarios!)
        expect(scenarioReview(saved, s).status).toBe("Needs review");
      await page.getByLabel("C2 view", { exact: true }).selectOption("focus-management");
      await page.getByRole("button", { name: "Fit View", exact: true }).click();
      await capture(page, `${product}-management-light`);
      if (product === "qrwty") {
        for (const [view, name] of [
          ["focus-redirect", "redirect"],
          ["focus-analytics", "analytics"],
        ]) {
          await page.getByLabel("C2 view", { exact: true }).selectOption(view!);
          await page.getByRole("button", { name: "Fit View", exact: true }).click();
          await capture(page, `${name}-light`);
        }
        await page.getByLabel("C2 view", { exact: true }).selectOption("");
        await editorAction(page, "Follow QR during cache or queue failure");
        const panel = page.getByRole("complementary", { name: "Scenario steps", exact: true });
        await expect(panel).toContainText("Needs review");
        await capture(page, "redirect-scenario-light");
        await panel.getByRole("button", { name: "Edit scenario", exact: true }).click();
        const scenario = page.getByRole("dialog", { name: "Edit scenario", exact: true });
        await expect(scenario).toContainText("Visit channel unavailable");
        await scenario.getByRole("button", { name: "Cancel", exact: true }).click();
        await editorAction(page, "Hide scenario");
      }
      await page.getByRole("button", { name: "C3 Components", exact: true }).click();
      await page.getByLabel("Component container").selectOption("api");
      await expect(
        page.getByRole("region", { name: "components diagram", exact: true }),
      ).toHaveAttribute("aria-busy", "false");
      await capture(page, `${product}-api-c3-light`);
      if (product === "qrwty") {
        await page
          .getByRole("button", { name: "Inspect Encoded payload definitions", exact: true })
          .click();
        await diagramAction(page, "Focus selected object");
        await capture(page, "payload-focus-light");
        await page
          .getByRole("complementary", { name: "Architecture details" })
          .getByRole("button", { name: "Manage interfaces", exact: true })
          .click();
        const interfaces = page.getByRole("dialog", { name: "Manage interfaces", exact: true });
        await interfaces
          .getByLabel("Definition", { exact: true })
          .selectOption(
            String(saved.architecture!.contracts!.findIndex((c) => c.id === "payload-command")),
          );
        await expect(
          interfaces.getByRole("textbox", { name: "Contract name", exact: true }),
        ).toHaveValue("Version encoded payload");
        await capture(page, "payload-contract-light", '[role="dialog"]');
        await interfaces.getByRole("button", { name: "Cancel", exact: true }).click();
      }
      await page.setViewportSize({ width: 390, height: 844 });
      await page.getByRole("button", { name: "Dark mode", exact: true }).click();
      await editorAction(page, /^Architecture review/);
      const review = page.getByRole("dialog", {
        name: "Architecture review and decisions",
        exact: true,
      });
      await review.getByRole("tab", { name: "Decisions", exact: true }).click();
      await review
        .getByLabel("Selected decision", { exact: true })
        .selectOption("production-objectives");
      await expect(
        review.getByRole("textbox", { name: "Decision title", exact: true }),
      ).toHaveValue("Production workload, SLO and recovery remain open");
      await capture(page, `${product}-review-dark-narrow`, '[role="dialog"]');
      await review.getByRole("button", { name: "Cancel", exact: true }).click();
      await page.getByRole("button", { name: "Undo", exact: true }).click();
      await expect
        .poll(async () => (await read()).elements.some((e) => e.id === "web"))
        .toBe(false);
      await page.getByRole("button", { name: "Redo", exact: true }).click();
      await expect.poll(async () => (await read()).architecture).toEqual(saved.architecture);
      await page.reload();
      expect((await read()).architecture).toEqual(saved.architecture);
    } finally {
      const cancel = page.getByRole("dialog").getByRole("button", { name: "Cancel", exact: true });
      if (await cancel.count()) await cancel.click();
      await page.getByRole("tab", { name: "Runs", exact: true }).click();
      await page.waitForLoadState("networkidle");
      await request.delete(`/api/projects/${id}`);
    }
  });
}

test("P56 retains a conflicted workshop preview and preserves the concurrent design", async ({
  page,
  request,
  browserProblems,
}) => {
  const id = await openNewProject(page, request, "P56 workshop conflict");
  try {
    await openWorkshop(page);
    await request.post(`/api/projects/${id}/operations`, {
      data: {
        baseRevision: 0,
        ops: [
          {
            op: "addElement",
            element: {
              id: "concurrent",
              name: "Concurrent block",
              planned: "application-api",
              template: null,
            },
          },
        ],
      },
    });
    const conflict = browserProblems.expectHttp({
      scenario: "P56 workshop conflict",
      resourceType: "fetch",
      status: 409,
      method: "POST",
      url: new URL(`/api/projects/${id}/operations`, page.url()).href,
    });
    await workshop(page).getByRole("button", { name: "Apply reviewed stage", exact: true }).click();
    await expect(workshop(page).getByRole("alert")).toBeVisible();
    await expect(workshop(page).getByRole("button", { name: "Cancel", exact: true })).toBeVisible();
    conflict.finish();
    await capture(page, "retained-conflict-light", '[role="dialog"]');
    const d = (await (await request.get(`/api/projects/${id}/design`)).json()).design;
    expect(d.elements.map((e: { id: string }) => e.id)).toEqual(["concurrent"]);
  } finally {
    await request.delete(`/api/projects/${id}`);
  }
});

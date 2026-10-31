import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "./browser-test.ts";

test("shows actual written-only and stale starter evidence without changing the design or C4 camera", async ({
  page,
  request,
}) => {
  test.setTimeout(90_000);
  const created = await request.post("/api/projects/from-starter", {
    data: { name: "Fieldwork evidence", starter: { id: "resource-workspace", version: "0.1.0" } },
  });
  expect(created.status()).toBe(201);
  const id = (await created.json()).project.id;
  const dir = mkdtempSync(join(tmpdir(), "jeeves-evidence-browser-"));
  const read = async () => (await (await request.get(`/api/projects/${id}/design`)).json()).design;
  try {
    await page.goto(`/?project=${id}#/draw`);
    await page.getByRole("button", { name: "Architecture", exact: true }).click();
    await page.getByRole("button", { name: "Inspect evidence", exact: true }).click();
    let dialog = page.getByRole("dialog", { name: "Architecture evidence" });
    await expect(
      dialog.getByRole("heading", { name: "No generation recorded", exact: true }),
    ).toBeVisible();
    await dialog.getByRole("button", { name: "Supplied & project work", exact: true }).click();
    await expect(
      dialog
        .getByRole("region", { name: "Supplied responsibilities" })
        .getByText("Resource workspace", { exact: true }),
    ).toBeVisible();
    await expect(
      dialog.getByText("No additional component implementation is declared in this scope.", {
        exact: true,
      }),
    ).toBeVisible();
    await dialog.getByRole("button", { name: "Open Generate", exact: true }).click();
    const generate = page.getByRole("region", { name: "Generate", exact: true });
    await generate.getByLabel("Output folder").fill(dir);
    await generate.getByLabel(/Run the baseline check/).uncheck();
    await generate.getByRole("button", { name: "Generate project", exact: true }).click();
    await expect(generate.getByRole("status")).toContainText("Written, baseline not run", {
      timeout: 45_000,
    });
    await generate.getByRole("button", { name: "Hide generate output" }).click();
    await page.getByRole("button", { name: "Architecture", exact: true }).click();
    await page.getByRole("button", { name: "Inspect evidence", exact: true }).click();
    dialog = page.getByRole("dialog", { name: "Architecture evidence" });
    await expect(
      dialog.getByRole("heading", { name: "Written · checks not run", exact: true }),
    ).toBeVisible();
    await page.screenshot({
      path: "test-results/p27-written-evidence.png",
      animations: "disabled",
    });
    await dialog.getByRole("button", { name: "Close evidence", exact: true }).click();
    await page.getByRole("button", { name: "Edit context", exact: true }).click();
    const context = page.getByRole("dialog", { name: "Edit system context" });
    await context.getByLabel("System responsibility").fill("Our edited inventory responsibility.");
    await context.getByRole("button", { name: "Save context", exact: true }).click();
    await expect(context).not.toBeVisible();
    const architecture = page.getByRole("region", { name: "Architecture workspace", exact: true });
    await architecture
      .getByRole("navigation", { name: "Architecture levels" })
      .getByRole("button", { name: /Containers/ })
      .click();
    await architecture.getByLabel("Inspect an object").selectOption("container:inventory");
    await architecture.getByRole("button", { name: "Zoom In", exact: true }).click();
    const viewport = architecture.locator(".react-flow__viewport");
    await expect(
      architecture.getByRole("button", { name: "Inspect Inventory API", exact: true }),
    ).toBeInViewport();
    const camera = await viewport.getAttribute("style"),
      design = await read();
    const layout = await (await request.get(`/api/projects/${id}/layout`)).json();
    await page.getByRole("button", { name: "Inspect evidence", exact: true }).click();
    dialog = page.getByRole("dialog", { name: "Architecture evidence" });
    await expect(
      dialog.getByText(
        /Stale design evidence: this record is for revision 0; the current design is revision 1/,
      ),
    ).toBeVisible();
    await dialog.getByRole("button", { name: "Refresh evidence", exact: true }).click();
    await expect(
      dialog.getByRole("button", { name: "Refresh evidence", exact: true }),
    ).toBeEnabled();
    await page.setViewportSize({ width: 650, height: 850 });
    expect(await dialog.evaluate((node) => node.scrollWidth <= node.clientWidth + 1)).toBe(true);
    await expect(
      dialog.getByRole("button", { name: "Open Generate", exact: true }),
    ).toBeInViewport();
    expect(
      (await new AxeBuilder({ page }).include('[role="dialog"]').analyze()).violations,
    ).toEqual([]);
    await page.screenshot({
      path: "test-results/p27-stale-evidence-narrow.png",
      animations: "disabled",
    });
    await page.setViewportSize({ width: 1440, height: 900 });
    await dialog.getByRole("button", { name: "Close evidence", exact: true }).click();
    await expect(architecture.getByLabel("Inspect an object")).toHaveValue("container:inventory");
    // Wait for the asynchronous resize layout and its camera fit before testing refresh alone.
    await expect(architecture.locator(".architecture-graph")).toHaveAttribute("aria-busy", "false");
    const beforeRefresh = await viewport.getAttribute("style");
    expect(camera).toBeTruthy();
    await page.getByRole("button", { name: "Inspect evidence", exact: true }).click();
    await dialog.getByRole("button", { name: "Refresh evidence", exact: true }).click();
    await expect(
      dialog.getByRole("button", { name: "Refresh evidence", exact: true }),
    ).toBeEnabled();
    await dialog.getByRole("button", { name: "Close evidence", exact: true }).click();
    expect(await viewport.getAttribute("style")).toBe(beforeRefresh);
    expect(await read()).toEqual(design);
    expect(await (await request.get(`/api/projects/${id}/layout`)).json()).toEqual(layout);
  } finally {
    rmSync(dir, { recursive: true, force: true });
    await request.delete(`/api/projects/${id}`);
  }
});

test("controlled read-only record renders layered outcomes, service-scoped references and a newer failed refresh", async ({
  page,
  request,
}) => {
  const created = await request.post("/api/projects/from-recipe", {
    data: { name: "Recorded evidence fixture", recipe: { id: "qr-studio", version: "0.1.0" } },
  });
  const id = (await created.json()).project.id;
  let failed = false;
  await page.route(`**/api/projects/${id}/architecture`, async (route) => {
    const response = await route.fetch(),
      data = await response.json();
    const record = {
      id: failed ? 2 : 1,
      revision: data.revision,
      outputDir: "/tmp/read-only-evidence-fixture",
      baseline: true,
      status: failed ? "failed" : "succeeded",
      createdAt: "2026-10-31T08:00:00Z",
      finishedAt: "2026-10-31T08:00:01Z",
      omittedChecks: 0,
      omittedStages: 0,
      stages: [
        "generate",
        "env",
        "install",
        "typecheck",
        "compose-up",
        "test-packs",
        "behavior",
        "compose-down",
      ].map((step) => ({
        id: step,
        title: step,
        status: failed && step === "behavior" ? "failed" : "passed",
      })),
      checks: [
        {
          subject: "qrwty/qrwty-api",
          template: "rest-api-server@0.2.0",
          id: "contract",
          title: "API boundary",
          status: "passed",
          layer: "template",
        },
        {
          subject: "qrwty",
          template: "acceptance",
          id: "analytics",
          title: "Owner analytics",
          status: failed ? "failed" : "passed",
          layer: "application",
          acceptanceIds: ["QR-15"],
        },
        {
          subject: "qrwty",
          template: "acceptance",
          id: "export",
          title: "Analytics exports",
          status: "skipped",
          layer: "application",
          acceptanceIds: ["QR-16"],
          reason: "Waiting for the declared export implementation.",
        },
        {
          subject: "another-service",
          template: "acceptance",
          id: "other",
          title: "Other service",
          status: "passed",
          layer: "application",
          acceptanceIds: ["QR-16"],
        },
      ],
    };
    data.evidence = {
      projectId: id,
      revision: data.revision,
      outputDir: record.outputDir,
      generation: record,
      run: {
        id: 1,
        revision: data.revision,
        outputDir: record.outputDir,
        status: "planned",
        updatedAt: record.finishedAt,
        tasks: { pending: 1 },
      },
    };
    await route.fulfill({ response, json: data });
  });
  try {
    await page.goto(`/?project=${id}#/draw`);
    await page.getByRole("button", { name: "Dark mode", exact: true }).click();
    await page.getByRole("button", { name: "Architecture", exact: true }).click();
    const architecture = page.getByRole("region", { name: "Architecture workspace", exact: true });
    await architecture
      .getByRole("navigation", { name: "Architecture levels" })
      .getByRole("button", { name: /Containers/ })
      .click();
    await architecture.getByLabel("Inspect an object").selectOption("container:qrwty");
    await architecture.getByRole("button", { name: "Open components", exact: true }).click();
    await architecture
      .getByLabel("Inspect an object")
      .selectOption("component:qrwty:qrwty-api:extension:owner-analytics");
    await page.getByRole("button", { name: "Inspect evidence", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "Architecture evidence" });
    await expect(
      dialog.getByRole("heading", { name: "Incomplete check evidence", exact: true }),
    ).toBeVisible();
    await dialog.getByLabel("Evidence scope").selectOption("qrwty");
    const references = dialog.getByRole("region", { name: "Selected acceptance references" });
    await expect(references.locator("li").filter({ hasText: "QR-15" })).toContainText("passed");
    await expect(references.locator("li").filter({ hasText: "QR-16" })).toContainText("skipped");
    await dialog
      .getByRole("region", { name: "Application acceptance", exact: true })
      .locator("summary")
      .click();
    expect(
      (await new AxeBuilder({ page }).include('[role="dialog"]').analyze()).violations,
    ).toEqual([]);
    await page.screenshot({
      path: "test-results/p27-controlled-record-dark.png",
      animations: "disabled",
    });
    failed = true;
    await dialog.getByRole("button", { name: "Refresh evidence", exact: true }).click();
    await expect(
      dialog.getByRole("heading", { name: "Latest generation failed", exact: true }),
    ).toBeVisible();
    await expect(dialog.getByLabel("Evidence scope")).toHaveValue("qrwty");
    await dialog.getByRole("button", { name: "Open Runs", exact: true }).click();
    await expect(page.getByRole("tab", { name: "Runs", exact: true })).toHaveAttribute(
      "aria-selected",
      "true",
    );
  } finally {
    await request.delete(`/api/projects/${id}`);
  }
});

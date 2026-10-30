import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { openNewProject } from "./helpers.ts";

/**
 * S10: the Generate button and drawer, by mouse. The baseline check (Docker) is covered by the
 * generator's conformance test; here generation writes files only.
 */

const fixture = JSON.parse(
  readFileSync(new URL("../../../fixtures/designs/link-shortener.json", import.meta.url), "utf8"),
) as { elements: unknown[]; connections: unknown[] };

const drawer = (page: import("@playwright/test").Page) =>
  page.getByRole("region", { name: "Generate" });

test("generates the fixture into a folder, then stops on a hand-edited generated file", async ({
  page,
  request,
}) => {
  const id = await openNewProject(page, request, "E2E generate");
  const ops = [
    ...fixture.elements.map((element) => ({ op: "addElement", element })),
    ...fixture.connections.map((connection) => ({ op: "connect", connection })),
  ];
  expect(
    (
      await request.post(`/api/projects/${id}/operations`, { data: { baseRevision: 0, ops } })
    ).status(),
  ).toBe(200);
  await page.reload();

  // Renaming the project (header menu) renames the default output folder too.
  await page.getByRole("button", { name: "Project: E2E generate" }).click();
  await page.getByRole("menuitem", { name: "Rename project" }).click();
  const rename = page.getByRole("dialog", { name: "Rename project" });
  await rename.getByRole("textbox", { name: "Project name" }).fill("E2E shorty");
  await rename.getByRole("button", { name: "Rename" }).click();
  await expect(page.getByRole("button", { name: "Project: E2E shorty" })).toBeVisible();
  await expect(rename).toHaveCount(0);

  await page.getByRole("button", { name: "Generate", exact: true }).click();
  await expect(drawer(page)).toBeVisible();
  const folder = drawer(page).getByRole("textbox", { name: "Output folder" });
  await expect(folder).toHaveValue(/e2e-shorty$/);

  const outputDir = join(mkdtempSync(join(tmpdir(), "jeeves-e2e-out-")), "shorty");
  await folder.fill(outputDir);
  await drawer(page)
    .getByRole("checkbox", { name: /Run the baseline check/ })
    .click();
  await drawer(page).getByRole("button", { name: "Generate project" }).click();

  await expect(drawer(page).getByRole("status")).toHaveText(/Written, baseline not run/, {
    timeout: 60_000,
  });
  await expect(drawer(page).getByText("Scaffolded (now project-owned)")).toBeVisible();
  await expect(drawer(page).getByRole("log", { name: "Output" })).toContainText("Vendoring");
  await expect(drawer(page).getByText("Started a git repository")).toBeVisible();
  expect(readFileSync(join(outputDir, "jeeves/lock.json"), "utf8")).toContain('"lockVersion": 1');

  await page.mouse.move(1, 1);
  const axe = await new AxeBuilder({ page }).include("#generate-drawer").analyze();
  expect(axe.violations).toEqual([]);

  // A hand edit to a generated-owned file stops the next generation.
  const compose = join(outputDir, "docker-compose.yml");
  writeFileSync(compose, `${readFileSync(compose, "utf8")}# hand edit\n`);
  await drawer(page).getByRole("button", { name: "Generate again" }).click();
  await expect(drawer(page).getByRole("status")).toHaveText(/Stopped/, { timeout: 30_000 });
  const problems = drawer(page).getByRole("region", { name: "Ownership problems" });
  await expect(problems).toContainText("docker-compose.yml was changed by hand");

  // The drawer remembers the folder and the last result after a reload.
  await page.reload();
  await page.getByRole("button", { name: "Generate", exact: true }).click();
  await expect(drawer(page).getByRole("textbox", { name: "Output folder" })).toHaveValue(outputDir);
  await expect(drawer(page).getByRole("status")).toHaveText(/Stopped/);

  await drawer(page).getByRole("button", { name: "Hide generate output" }).click();
  await expect(drawer(page)).toHaveCount(0);
});

test("explains why an empty design can't be generated", async ({ page, request }) => {
  await openNewProject(page, request, "E2E generate empty");
  await page.getByRole("button", { name: "Generate", exact: true }).click();
  await expect(drawer(page).getByRole("note")).toHaveText(/Add at least one element/);
  await expect(drawer(page).getByRole("button", { name: "Generate project" })).toBeDisabled();
});

test("shows template conformance separately from deferred application acceptance by mouse", async ({
  page,
  request,
}) => {
  const id = await openNewProject(page, request, "E2E verification layers");
  await page.route(`**/api/projects/${id}/generation`, (route) =>
    route.fulfill({
      json: {
        defaultOutputDir: "/tmp/verification-display",
        outputDir: "/tmp/verification-display",
        latest: {
          id: 99,
          projectId: id,
          revision: 0,
          outputDir: "/tmp/verification-display",
          baseline: true,
          status: "succeeded",
          createdAt: new Date().toISOString(),
          finishedAt: new Date().toISOString(),
          report: null,
          error: null,
          log: [],
          steps: [
            {
              id: "compose-up",
              title: "Infrastructure readiness: start with Docker Compose",
              status: "passed",
              durationMs: 100,
            },
          ],
          checks: [
            {
              subject: "api",
              template: "resources",
              id: "qr",
              title: "Independent standard behavior: qr",
              layer: "template",
              status: "passed",
              durationMs: 100,
            },
            {
              subject: "project",
              template: "acceptance",
              id: "deferred",
              title: "Remaining extension acceptance",
              layer: "application",
              status: "skipped",
              durationMs: 0,
              reason: "Deferred until implementation: api/downloadQr, api/followQr",
            },
          ],
        },
      },
    }),
  );
  await page.reload();
  await page.getByRole("button", { name: "Generate", exact: true }).click();
  await expect(
    drawer(page).getByRole("heading", { name: "Template conformance: 1 of 1 passed" }),
  ).toBeVisible();
  const acceptance = drawer(page).getByRole("region", { name: "Application acceptance" });
  await expect(acceptance.getByRole("heading")).toHaveText(
    "Application acceptance: 0 of 1 passed; 1 skipped",
  );
  await expect(acceptance).toContainText("api/downloadQr, api/followQr");
  await page.mouse.move(1, 1);
  expect((await new AxeBuilder({ page }).include("#generate-drawer").analyze()).violations).toEqual(
    [],
  );
  await drawer(page).getByRole("button", { name: "Hide generate output" }).click();
  await expect(drawer(page)).toHaveCount(0);
});

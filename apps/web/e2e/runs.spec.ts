import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import AxeBuilder from "@axe-core/playwright";
import { type APIRequestContext, expect, type Page, test } from "@playwright/test";
import { openNewProject } from "./helpers.ts";

/**
 * S11: planning a generated project with the (scripted) planner, editing the plan, and running
 * it with the stub executor, all by mouse. The planner's answer is the "Refine the seed plan" turn
 * in fixtures/chat/e2e-script.json.
 */

const fixture = JSON.parse(
  readFileSync(new URL("../../../fixtures/designs/link-shortener.json", import.meta.url), "utf8"),
) as { elements: unknown[]; connections: unknown[] };

/** A project with the fixture design, generated (without the baseline) into a temp folder. */
async function generatedProject(page: Page, request: APIRequestContext, name: string) {
  const id = await openNewProject(page, request, name);
  const ops = [
    ...fixture.elements.map((element) => ({ op: "addElement", element })),
    ...fixture.connections.map((connection) => ({ op: "connect", connection })),
  ];
  const edited = await request.post(`/api/projects/${id}/operations`, {
    data: { baseRevision: 0, ops },
  });
  expect(edited.status()).toBe(200);
  const outputDir = join(mkdtempSync(join(tmpdir(), "jeeves-e2e-runs-")), "shorty");
  const started = await request.post(`/api/projects/${id}/generations`, {
    data: { outputDir, baseline: false },
  });
  expect(started.status()).toBe(202);
  await expect
    .poll(
      async () =>
        (
          (await (await request.get(`/api/projects/${id}/generation`)).json()) as {
            latest: { status: string };
          }
        ).latest.status,
      { timeout: 60_000 },
    )
    .toBe("succeeded");
  return { id, outputDir };
}

const runStatus = (page: Page) => page.getByRole("status", { name: "Run status" });
const titles = (page: Page) => page.getByRole("list", { name: "Tasks" }).locator("h3");
const task = (page: Page, name: string) => page.getByRole("article", { name });

test("plans a generated project, edits the plan, and runs it with Pause and Resume", async ({
  page,
  request,
}) => {
  test.setTimeout(90_000);
  const { id, outputDir } = await generatedProject(page, request, "E2E runs");
  await page.getByRole("tab", { name: "Runs" }).click();
  await expect(page.getByText(`Plans the project in ${outputDir}.`)).toBeVisible();
  await expect(page.getByText("Nothing planned yet")).toBeVisible();

  await page.getByRole("button", { name: "Plan a run" }).click();
  await expect(runStatus(page)).toHaveText("Planned", { timeout: 15_000 });
  await expect(titles(page)).toHaveText([
    "Create and fetch short links",
    "Redirect short codes",
    "Count clicks",
    "Shorten form and recent links",
  ]);
  await expect(page.getByText(/Refined by the planner \(fake\)/)).toBeVisible();
  await expect(page.getByRole("list", { name: "Warnings" })).toContainText(
    "baseline check hasn't passed",
  );
  await expect(task(page, "Redirect short codes")).toContainText("An unknown code returns 404");
  await expect(task(page, "Redirect short codes")).toContainText("services/links/");

  // Edit a task's title and acceptance tests.
  await task(page, "Count clicks").getByRole("button", { name: 'Edit "Count clicks"' }).click();
  await page.getByRole("textbox", { name: "Title" }).fill("Count clicks per link");
  await page
    .getByRole("textbox", { name: /Acceptance tests/ })
    .fill("Two redirects count 2\nA new link counts 0");
  await page.getByRole("button", { name: "Save task" }).click();
  await expect(task(page, "Count clicks per link")).toContainText("A new link counts 0");
  await expect(task(page, "Count clicks per link")).toContainText("edited");

  // Move it up, and move the web task above the service it depends on (a warning, not an error).
  await page.getByRole("button", { name: 'Move "Count clicks per link" up' }).click();
  await expect(titles(page).nth(1)).toHaveText("Count clicks per link");
  await page.getByRole("button", { name: 'Move "Shorten form and recent links" up' }).click();
  await expect(titles(page).nth(2)).toHaveText("Shorten form and recent links");
  await expect(task(page, "Shorten form and recent links")).toContainText(
    "but web depends on links",
  );
  await page.getByRole("button", { name: 'Move "Shorten form and recent links" down' }).click();
  await expect(titles(page).nth(3)).toHaveText("Shorten form and recent links");

  // Remove one, after confirming.
  await page.getByRole("button", { name: 'Remove "Redirect short codes"' }).click();
  await page.getByRole("button", { name: "Remove task" }).click();
  await expect(titles(page)).toHaveText([
    "Create and fetch short links",
    "Count clicks per link",
    "Shorten form and recent links",
  ]);

  // The edits are saved on the server.
  await page.reload();
  await expect(runStatus(page)).toHaveText("Planned");
  await expect(titles(page)).toHaveText([
    "Create and fetch short links",
    "Count clicks per link",
    "Shorten form and recent links",
  ]);

  await page.mouse.move(1, 1);
  const axe = await new AxeBuilder({ page }).include("#view-panel").analyze();
  expect(axe.violations).toEqual([]);

  // Run it: pause after the first task, then resume to the end.
  await page.getByRole("button", { name: "Start" }).click();
  await expect(runStatus(page)).toHaveText("Running");
  await expect(page.getByRole("button", { name: /Edit "/ })).toHaveCount(0);
  await expect(task(page, "Create and fetch short links")).toContainText("Running");
  await page.getByRole("button", { name: "Pause" }).click();
  await expect(runStatus(page)).toHaveText("Paused");
  await expect(task(page, "Create and fetch short links")).toContainText("Done", {
    timeout: 10_000,
  });
  await expect(task(page, "Count clicks per link")).toContainText("To do");
  await page.waitForTimeout(2500);
  await expect(task(page, "Count clicks per link")).toContainText("To do");

  await page.getByRole("button", { name: "Resume" }).click();
  await expect(runStatus(page)).toHaveText("Succeeded", { timeout: 20_000 });
  for (const name of [
    "Create and fetch short links",
    "Count clicks per link",
    "Shorten form and recent links",
  ]) {
    await expect(task(page, name)).toContainText("Done");
    await expect(task(page, name)).toContainText("Attempt 1: succeeded");
  }
  await expect(page.getByRole("list", { name: "All runs" })).toContainText("3/3 tasks");

  // A new run can be planned and cancelled.
  await page.getByRole("button", { name: "Plan a run" }).click();
  await expect(runStatus(page)).toHaveText("Planned", { timeout: 15_000 });
  await page.getByRole("button", { name: "Cancel run" }).click();
  await page.getByRole("button", { name: "Yes, cancel run" }).click();
  await expect(runStatus(page)).toHaveText("Cancelled");
  await expect(task(page, "Count clicks")).toContainText("Cancelled");
  const runs = (await (await request.get(`/api/projects/${id}/runs`)).json()) as {
    runs: { status: string }[];
  };
  expect(runs.runs.map((r) => r.status)).toEqual(["cancelled", "succeeded"]);
});

test("explains that a project must be generated before planning", async ({ page, request }) => {
  await openNewProject(page, request, "E2E runs not generated");
  await page.getByRole("tab", { name: "Runs" }).click();
  await expect(page.getByText(/Generate the project first/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Plan a run" })).toBeDisabled();
});

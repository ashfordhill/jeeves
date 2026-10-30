import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import AxeBuilder from "@axe-core/playwright";
import { type APIRequestContext, expect, type Page, test } from "@playwright/test";
import { openNewProject } from "./helpers.ts";

/**
 * S11–S12: planning a generated project with the (scripted) planner, editing the plan, and
 * running it with the scripted coding agent (fixtures/coding/e2e-script.json) and quick marker
 * checks, all by mouse. The planner's answer is the "Refine the seed plan" turn in
 * fixtures/chat/e2e-script.json.
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
  await page.getByText("Plan and Git details", { exact: true }).click();
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

test("a failing task shows its evidence, needs attention, and resumes to a commit", async ({
  page,
  request,
}) => {
  test.setTimeout(90_000);
  const { outputDir } = await generatedProject(page, request, "E2E runs failing");
  await page.getByRole("tab", { name: "Runs" }).click();

  // No retries, and commits straight onto the run branch.
  await page.getByText("New run settings", { exact: true }).click();
  await page.getByRole("combobox", { name: "Retries after a failed attempt" }).selectOption("0");
  await page.getByRole("combobox", { name: "Git strategy" }).selectOption("direct");
  await page.getByRole("button", { name: "Plan a run" }).click();
  await expect(runStatus(page)).toHaveText("Planned", { timeout: 15_000 });
  await page.getByText("Plan and Git details", { exact: true }).click();
  await expect(
    page.getByText(/Direct: commit each task on the run branch · up to 0 retries/),
  ).toBeVisible();

  // The marker checks fail on this text, which the scripted agent copies from the brief.
  const first = "Create and fetch short links";
  await task(page, first)
    .getByRole("button", { name: `Edit "${first}"` })
    .click();
  await page
    .getByRole("textbox", { name: "Description" })
    .fill("POST /api/links. JEEVES_FAKE_CHECK_FAIL");
  await page.getByRole("button", { name: "Save task" }).click();

  await page.getByRole("button", { name: "Start" }).click();
  // Open the running attempt to inspect its streamed evidence.
  await task(page, first)
    .getByRole("button", { name: /Attempt 1: running/ })
    .click();
  await expect(task(page, first).getByRole("list", { name: "Attempt log" })).toContainText(
    "Starting a fake session",
    { timeout: 10_000 },
  );
  await expect(runStatus(page)).toHaveText("Needs attention", { timeout: 15_000 });
  await expect(page.getByText(/failed: Jeeves's checks failed/).first()).toBeVisible();
  await expect(task(page, first)).toContainText("Attempt 1: failed");

  const card = task(page, first);
  await card.getByRole("tab", { name: "Checks" }).click();
  await expect(card).toContainText("Unit and project tests: failed");
  await expect(card).toContainText("Owned paths: every change is inside the task's paths");
  await card.getByRole("tab", { name: /Changes/ }).click();
  await expect(card).toContainText("services/links/src/features/links-api.ts");
  await expect(card.locator(".attempt-diff")).toContainText(
    "+Jeeves task: links.links-api, attempt 1",
  );

  await page.mouse.move(1, 1);
  const axe = await new AxeBuilder({ page }).include("#view-panel").analyze();
  expect(axe.violations).toEqual([]);

  // Resume: the retry gets the check output instead of the brief, so it passes.
  await page.getByRole("button", { name: "Resume" }).click();
  await expect(runStatus(page)).toHaveText("Succeeded", { timeout: 30_000 });
  await expect(task(page, first)).toContainText("Attempt 2: succeeded");
  await expect(task(page, first)).toContainText(/Committed [0-9a-f]{10}/);
  await expect(page.getByText(/work goes to jeeves\/run-\d+ in/)).toBeVisible();
  expect(outputDir).toBeTruthy();
});

test("explains that a project must be generated before planning", async ({ page, request }) => {
  await openNewProject(page, request, "E2E runs not generated");
  await page.getByRole("tab", { name: "Runs" }).click();
  await expect(page.getByText(/Generate the project first/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Plan a run" })).toBeDisabled();
});

test("review mode persists across reload and shows cumulative usage and human help", async ({
  page,
  request,
}) => {
  test.setTimeout(90_000);
  const { id } = await generatedProject(page, request, "P5 review mode");
  await page.getByRole("tab", { name: "Runs" }).click();
  await page.getByRole("button", { name: "Plan a run" }).click();
  await expect(runStatus(page)).toHaveText("Planned", { timeout: 15_000 });
  await expect(page.getByRole("region", { name: "Implementation progress" })).toContainText(
    "Coding model: fake / fake",
  );
  await page.getByRole("combobox", { name: "Execution mode" }).selectOption("review-after-task");
  await page.reload();
  await expect(page.getByRole("combobox", { name: "Execution mode" })).toHaveValue(
    "review-after-task",
  );
  await expect(task(page, "Redirect short codes").locator(".task-description")).not.toHaveAttribute(
    "open",
  );
  await task(page, "Redirect short codes").getByText("Task details", { exact: true }).click();
  await expect(task(page, "Redirect short codes").locator(".run-task-description")).toBeVisible();
  await page.getByRole("button", { name: "Start" }).click();
  await expect(runStatus(page)).toHaveText("Paused", { timeout: 20_000 });
  await expect(page.getByText(/passed verification and was committed/)).toBeVisible();
  await expect(task(page, "Create and fetch short links")).toContainText("Done");
  await expect(task(page, "Redirect short codes")).toContainText("To do");
  await page.reload();
  await expect(runStatus(page)).toHaveText("Paused");
  await page.getByText("Usage ledger, provenance and human help", { exact: true }).click();
  await page
    .getByRole("textbox", { name: "Human help or review note" })
    .fill("Reviewed first task and its checks.");
  await page.getByRole("button", { name: "Record note" }).click();
  await expect(page.getByRole("list", { name: "Human interventions" })).toContainText(
    "Reviewed first task and its checks.",
  );
  await expect(page.getByRole("complementary", { name: "Runs" })).toContainText(
    "Cumulative implementation",
  );
  await page.getByRole("button", { name: "Resume" }).click();
  await expect(runStatus(page)).toHaveText("Paused", { timeout: 20_000 });
  await expect(task(page, "Redirect short codes")).toContainText("Done");
  await page.getByRole("combobox", { name: "Execution mode" }).selectOption("continuous");
  await page.getByRole("button", { name: "Resume" }).click();
  await expect(runStatus(page)).toHaveText("Succeeded", { timeout: 30_000 });
  const detail = await (await request.get(`/api/projects/${id}/runs`)).json();
  expect(detail.implementation).toMatchObject({ records: 5, tokenRecords: 5, costRecords: 0 });
  await page.screenshot({ path: "/tmp/jeeves-p5-runs.png", fullPage: true });
  await page.mouse.move(1, 1);
  expect((await new AxeBuilder({ page }).include("#view-panel").analyze()).violations).toEqual([]);
});

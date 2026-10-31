import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";
import { expect, test } from "./browser-test.ts";
import { card, designOf, layoutOf, openNewProject } from "./helpers.ts";

/**
 * S5: inspector, findings, and history, all driven by mouse. Text still has to be typed, but
 * every field is committed by clicking somewhere else, never by a key.
 */

async function place(page: Page, template: string, x: number, y: number) {
  await page.getByRole("button", { name: "Elements" }).click();
  await page.getByRole("button", { name: new RegExp(`^${template}`) }).click();
  await page.locator(".react-flow__pane").click({ position: { x, y } });
}

const rail = (page: Page) =>
  page.getByRole("complementary", { name: "Inspector, findings, and chat" });

/** Clicks a section heading in the rail, which moves focus off the field being edited. */
async function clickAway(page: Page) {
  await rail(page).getByRole("heading", { name: "Implementation notes" }).click();
}

async function expectNoAxeViolations(page: Page) {
  // Toolbar tooltips are transient portals outside any landmark; scan without one open.
  await page.mouse.move(1, 1);
  await expect(page.getByRole("tooltip")).toHaveCount(0);
  const axe = await new AxeBuilder({ page }).analyze();
  expect(axe.violations).toEqual([]);
}

test("edits config and notes, sees findings appear and clear, and undoes and redoes", async ({
  page,
  request,
}) => {
  const id = await openNewProject(page, request, "E2E inspector");
  await place(page, "Web app", 400, 320);
  const web = card(page, "Web app, Web app");
  await expect(web).toBeVisible();

  // The web app's title has no default: a finding on the card and in the Findings tab.
  await expect(web.getByRole("img", { name: "1 finding" })).toBeVisible();
  const findingsTab = rail(page).getByRole("tab", { name: /Findings/ });
  await expect(findingsTab).toContainText("1");
  await findingsTab.click();
  await rail(page)
    .getByRole("button", { name: /Web app.*needs a value for "title"/ })
    .click();

  // Clicking the finding selects the card and opens it in the inspector.
  await expect(rail(page).getByRole("tab", { name: "Inspector" })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await expect(web).toHaveClass(/is-selected/);
  await expect(rail(page).getByRole("textbox", { name: "Name" })).toHaveValue("Web app");
  await expectNoAxeViolations(page);

  const title = rail(page).getByRole("textbox", { name: /^Title/ });
  await expect(rail(page).getByText("Required")).toBeVisible();
  await title.click();
  await page.keyboard.type("Link shortener");
  await clickAway(page);

  await expect(web.getByRole("img", { name: /finding/ })).toHaveCount(0);
  await expect(findingsTab).toContainText("0");
  await expect(rail(page).getByText("Required")).toHaveCount(0);
  await expect(web).toContainText("Link shortener");

  // Port by the stepper buttons alone: the field shows the default (5173) and steps from it.
  const port = rail(page).getByRole("textbox", { name: /^Port/ });
  await expect(port).toHaveValue("5173");
  await port.locator("xpath=..").locator(".mantine-NumberInput-control").first().click();
  await expect(port).toHaveValue("5174");
  await clickAway(page);
  await expect
    .poll(async () => (await designOf(request, id)).design.elements[0]?.config)
    .toEqual({ title: "Link shortener", port: 5174 });

  const notes = rail(page).getByRole("textbox", { name: "Notes" });
  await notes.click();
  await page.keyboard.type("Lists links and their click counts.");
  await rail(page).getByRole("heading", { name: "Configuration" }).click();
  await expect
    .poll(async () => (await designOf(request, id)).design.elements[0]?.notes)
    .toBe("Lists links and their click counts.");
  const edited = (await designOf(request, id)).design.revision;

  // Undo three times: notes, port, then title (and its finding comes back).
  const undo = page.getByRole("button", { name: "Undo" });
  const redo = page.getByRole("button", { name: "Redo" });
  await undo.click();
  await expect(notes).toHaveValue("");
  await undo.click();
  await expect(port).toHaveValue("5173");
  await undo.click();
  await expect(title).toHaveValue("");
  await expect(web.getByRole("img", { name: "1 finding" })).toBeVisible();
  await expect(rail(page).getByText("Required")).toBeVisible();
  let saved = (await designOf(request, id)).design;
  expect(saved.revision).toBe(edited + 3);
  expect(saved.elements[0]?.config).toEqual({});

  // Redo all three: the finding clears again.
  await redo.click();
  await expect(title).toHaveValue("Link shortener");
  await redo.click();
  await redo.click();
  await expect(notes).toHaveValue("Lists links and their click counts.");
  await expect(redo).toBeDisabled();
  await expect(web.getByRole("img", { name: /finding/ })).toHaveCount(0);
  saved = (await designOf(request, id)).design;
  expect(saved.elements[0]?.config).toEqual({ title: "Link shortener", port: 5174 });
  expect(saved.elements[0]?.notes).toBe("Lists links and their click counts.");

  await findingsTab.click();
  await expect(rail(page).getByText("No findings. The design is ready to generate.")).toBeVisible();
  await expectNoAxeViolations(page);
});

test("refuses a malformed value at the field and edits attachment config", async ({
  page,
  request,
}) => {
  const id = await openNewProject(page, request, "E2E inspector fields");
  await place(page, "HTTP service", 400, 320);
  const service = card(page, "HTTP service, HTTP service");
  await service.click();

  // An enum by mouse.
  await rail(page).getByRole("combobox", { name: "Log level" }).selectOption("debug");
  await expect
    .poll(async () => (await designOf(request, id)).design.elements[0]?.config)
    .toEqual({ logLevel: "debug" });

  // The reset button clears it back to the default.
  await rail(page).getByRole("button", { name: "Reset Log level to default (info)" }).click();
  await expect
    .poll(async () => (await designOf(request, id)).design.elements[0]?.config)
    .toEqual({});
  await expect(rail(page).getByRole("combobox", { name: "Log level" })).toHaveValue("info");
  const revision = (await designOf(request, id)).design.revision;

  // Out of range: shown at the field, nothing posted.
  const port = rail(page).getByRole("textbox", { name: /^Port/ });
  await port.click();
  await page.keyboard.type("70000");
  await clickAway(page);
  await expect(rail(page).getByText(/65535/)).toBeVisible();
  expect((await designOf(request, id)).design.revision).toBe(revision);

  // Add an attachment from the inspector and edit its config there.
  await rail(page).getByRole("button", { name: "Add attachment" }).click();
  await page.getByRole("menuitem", { name: "REST API server" }).click();
  await expect(service.getByRole("listitem", { name: "REST API server" })).toBeVisible();
  const attachment = rail(page).getByRole("listitem", { name: /REST API server attachment/ });
  await attachment.getByRole("combobox", { name: "Auth" }).selectOption("bearer");
  await expect
    .poll(
      async () =>
        (
          (await designOf(request, id)).design.elements[0]?.attachments[0] as {
            config?: unknown;
          }
        )?.config,
    )
    .toEqual({ auth: "bearer" });
});

test("deletes a multi-selection, zooms to it, and undoes moves", async ({ page, request }) => {
  const id = await openNewProject(page, request, "E2E selection");
  await place(page, "HTTP service", 300, 300);
  await place(page, "PostgreSQL", 700, 300);
  const service = card(page, "HTTP service, HTTP service");
  const db = card(page, "PostgreSQL, PostgreSQL");
  await expect(db).toBeVisible();

  // Move the service, then undo the move: the saved layout goes back.
  await expect.poll(async () => (await layoutOf(request, id)).items["http-service"]).toBeTruthy();
  const start = (await layoutOf(request, id)).items["http-service"];
  const box = await service.boundingBox();
  if (!box || !start) throw new Error("service card not laid out");
  await page.mouse.move(box.x + 60, box.y + 20);
  await page.mouse.down();
  await page.mouse.move(box.x + 60, box.y + 220, { steps: 8 });
  await page.mouse.up();
  await expect
    .poll(async () => (await layoutOf(request, id)).items["http-service"]?.y)
    .not.toBe(start.y);
  const revision = (await designOf(request, id)).design.revision;
  await page.getByRole("button", { name: "Undo" }).click();
  await expect.poll(async () => (await layoutOf(request, id)).items["http-service"]).toEqual(start);
  expect((await designOf(request, id)).design.revision).toBe(revision);

  // Rubber-band select both cards with the mouse.
  const pane = page.locator(".react-flow__pane");
  const paneBox = await pane.boundingBox();
  if (!paneBox) throw new Error("no pane");
  await page.mouse.move(paneBox.x + 40, paneBox.y + 120);
  await page.mouse.down();
  await page.mouse.move(paneBox.x + paneBox.width - 40, paneBox.y + paneBox.height - 80, {
    steps: 10,
  });
  await page.mouse.up();
  await expect(rail(page).getByText("2 items selected")).toBeVisible();

  const viewport = page.locator(".react-flow__viewport");
  const before = await viewport.getAttribute("style");
  await page.getByRole("button", { name: "Zoom to selection" }).first().click();
  await expect.poll(() => viewport.getAttribute("style")).not.toBe(before);

  await rail(page).getByRole("button", { name: "Delete 2 items" }).click();
  await expect(service).toHaveCount(0);
  await expect(db).toHaveCount(0);
  expect((await designOf(request, id)).design.elements).toEqual([]);

  // One delete is one undo step.
  await page.getByRole("button", { name: "Undo" }).click();
  await expect(service).toBeVisible();
  await expect(db).toBeVisible();
});

test("reloads the design and says so when another edit got there first", async ({
  page,
  request,
  browserProblems,
}) => {
  const id = await openNewProject(page, request, "E2E conflict");
  await place(page, "HTTP service", 400, 320);
  const service = card(page, "HTTP service, HTTP service");
  await service.click();
  const name = rail(page).getByRole("textbox", { name: "Name" });
  await expect(name).toHaveValue("HTTP service");

  // Someone else renames it behind the board's back.
  const { design } = await designOf(request, id);
  const res = await request.post(`/api/projects/${id}/operations`, {
    data: {
      baseRevision: design.revision,
      ops: [{ op: "updateElement", id: "http-service", name: "Links service" }],
    },
  });
  expect(res.status()).toBe(200);

  const conflict = browserProblems.expectHttp({
    scenario: "another editor changed the revision",
    method: "POST",
    url: new URL(`/api/projects/${id}/operations`, page.url()).href,
    resourceType: "fetch",
    status: 409,
  });
  await name.click();
  await name.fill("My service");
  await clickAway(page);
  await expect(
    page.getByRole("status").filter({ hasText: "changed somewhere else" }),
  ).toBeVisible();
  conflict.finish();
  await expect(card(page, "Links service, HTTP service")).toBeVisible();
  await expect(name).toHaveValue("Links service");
  const saved = (await designOf(request, id)).design;
  expect(saved.elements[0]?.name).toBe("Links service");
  expect(saved.revision).toBe(design.revision + 1);
});

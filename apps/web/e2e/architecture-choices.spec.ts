import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "./browser-test.ts";
import { editorAction, openNewProject } from "./helpers.ts";

test("P46 system choices and architectural boundaries persist through mouse authoring", async ({
  page,
  request,
  browserProblems,
}) => {
  test.setTimeout(90_000);
  const id = await openNewProject(page, request, "P46 choices");
  const read = async () => (await (await request.get(`/api/projects/${id}/design`)).json()).design;
  const details = page.getByRole("complementary", { name: "Architecture details" });
  try {
    await editorAction(page, "Show inspector");
    for (const [name, x, y] of [
      ["Relational database", 180, 240],
      ["Observability", 600, 240],
      ["Job queue", 180, 500],
      ["Job queue", 600, 500],
    ] as const) {
      await page.getByRole("button", { name: "Library", exact: true }).click();
      const library = page.getByRole("dialog", { name: "Architecture library" });
      await library.getByRole("textbox", { name: "Search building blocks" }).fill(name);
      await library.locator(".catalog-card").getByText(name, { exact: true }).click();
      await page.locator(".react-flow__pane").click({ position: { x, y } });
    }
    const initial = await read();
    const db = initial.elements.find((e: { planned: string }) => e.planned === "relational-store");
    const collector = initial.elements.find(
      (e: { planned: string }) => e.planned === "observability",
    );
    await page.locator(`[data-element-id="${db.id}"] .element-card-name`).click();
    await details.getByLabel("Operation", { exact: true }).selectOption("Externally operated");
    await details.getByRole("button", { name: "Save options", exact: true }).click();
    await expect
      .poll(
        async () =>
          (await read()).elements.find((e: { id: string }) => e.id === db.id).classification
            ?.operation,
      )
      .toBe("Externally operated");
    await page.getByRole("button", { name: "Fit View", exact: true }).click();
    await page.locator(`[data-element-id="${collector.id}"] .element-card-name`).click();
    await details.getByLabel("Architectural classification").selectOption("Application");
    await details.getByLabel("Responsibility ownership").selectOption("System responsibility");
    await details.getByLabel("Operation", { exact: true }).selectOption("Self operated");
    await details.getByRole("button", { name: "Save options", exact: true }).click();
    await expect
      .poll(
        async () =>
          (await read()).elements.find((e: { id: string }) => e.id === collector.id).classification
            ?.kind,
      )
      .toBe("Application");
    await page.getByRole("button", { name: "Undo", exact: true }).click();
    await expect(details.getByLabel("Architectural classification")).toHaveValue("");
    await page.getByRole("button", { name: "Redo", exact: true }).click();
    await expect(details.getByLabel("Architectural classification")).toHaveValue("Application");
    await page.screenshot({ path: "test-results/p46-collector-light.png", animations: "disabled" });
    await page.getByRole("button", { name: "C1 Context", exact: true }).click();
    await page.getByRole("button", { name: "Describe this system" }).click();
    const dialog = page.getByRole("dialog");
    await dialog
      .getByLabel("System responsibility")
      .fill("Manages client workspaces and public links.");
    await dialog.getByLabel("Business tenancy", { exact: true }).selectOption("Organizations");
    await dialog.getByLabel("Data isolation", { exact: true }).selectOption("Shared scoped data");
    await dialog.getByRole("button", { name: "Save context", exact: true }).click();
    await page.getByRole("button", { name: "Inspect P46 choices", exact: true }).click();
    await details
      .getByLabel("Data isolation", { exact: true })
      .selectOption("Dedicated infrastructure");
    await details.getByRole("button", { name: "Cancel", exact: true }).click();
    await expect(details.getByLabel("Data isolation", { exact: true })).toHaveValue(
      "Shared scoped data",
    );
    await details
      .getByLabel("Data isolation", { exact: true })
      .selectOption("Dedicated infrastructure");
    await details.getByRole("button", { name: "Save context", exact: true }).click();
    await expect
      .poll(async () => (await read()).architecture.system.dataIsolation)
      .toBe("Dedicated infrastructure");
    await page.getByRole("button", { name: "Undo", exact: true }).click();
    await expect(details.getByLabel("Data isolation", { exact: true })).toHaveValue(
      "Shared scoped data",
    );
    await page.getByRole("button", { name: "Redo", exact: true }).click();
    await expect(details.getByLabel("Data isolation", { exact: true })).toHaveValue(
      "Dedicated infrastructure",
    );
    await expect(page.locator(".architecture-card-description")).toContainText([
      "Audience: Organizations",
    ]);
    await page.screenshot({ path: "test-results/p46-system-light.png", animations: "disabled" });
    await details.getByLabel("Data isolation", { exact: true }).selectOption("Schema per tenant");
    const current = await read();
    expect(
      (
        await request.post(`/api/projects/${id}/operations`, {
          data: {
            baseRevision: current.revision,
            ops: [{ op: "updateElement", id: db.id, name: "Renamed externally" }],
          },
        })
      ).status(),
    ).toBe(200);
    const conflict = browserProblems.expectHttp({
      scenario: "system intent draft conflict",
      method: "POST",
      url: new URL(`/api/projects/${id}/operations`, page.url()).href,
      resourceType: "fetch",
      status: 409,
    });
    await details.getByRole("button", { name: "Save context", exact: true }).click();
    await expect(details.getByRole("alert")).toContainText("board was reloaded");
    await expect(details.getByLabel("Data isolation", { exact: true })).toHaveValue(
      "Schema per tenant",
    );
    conflict.finish();
    await details.getByRole("button", { name: "Cancel", exact: true }).click();
    await expect(details.getByLabel("Data isolation", { exact: true })).toHaveValue(
      "Dedicated infrastructure",
    );
    const saved = await read();
    expect(
      saved.elements.filter((e: { planned: string }) => e.planned === "job-queue"),
    ).toHaveLength(2);
    expect(saved.architecture.system).not.toHaveProperty("authorization");
    await page.reload();
    expect(await read()).toEqual(saved);
    await page.getByRole("button", { name: "C1 Context", exact: true }).click();
    await page.getByRole("button", { name: "Inspect P46 choices", exact: true }).click();
    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByRole("button", { name: "Dark mode", exact: true }).click();
    await details
      .getByRole("button", { name: "Save context", exact: true })
      .scrollIntoViewIfNeeded();
    await page.screenshot({ path: "test-results/p46-system-dark.png", animations: "disabled" });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    expect(
      (await new AxeBuilder({ page }).include(".integrated-editor").analyze()).violations,
    ).toEqual([]);
  } finally {
    await request.delete(`/api/projects/${id}`);
  }
});

test("P46 responsibility families place inside a compatible API through the library", async ({
  page,
  request,
}) => {
  test.setTimeout(90_000);
  const seed = await openNewProject(page, request, "P46 component chooser");
  let id = seed;
  try {
    await page.getByRole("button", { name: "Explore SaaS examples", exact: true }).click();
    const library = page.getByRole("dialog", { name: "Architecture library" });
    const created = page.waitForResponse(
      (r) => r.url().endsWith("/api/projects") && r.request().method() === "POST",
    );
    await library
      .getByRole("button", { name: "Create qrwty target architecture", exact: true })
      .click();
    id = (await (await created).json()).project.id;
    await expect(library).not.toBeVisible();
    await page.getByRole("button", { name: "C3 Components", exact: true }).click();
    await page.getByLabel("Component container").selectOption("api");
    for (const name of [
      "Entitlements & quotas",
      "Abuse & trust/safety",
      "Custom domains",
      "Data lifecycle",
    ]) {
      await page.getByRole("button", { name: "Library", exact: true }).click();
      await library.getByRole("textbox", { name: "Search building blocks" }).fill(name);
      await library.locator(".catalog-card").getByText(name, { exact: true }).click();
      const component = page.getByRole("dialog", { name: "Add component", exact: true });
      await expect(component.getByLabel("Component type", { exact: true })).toBeVisible();
      await component.getByRole("button", { name: "Save component", exact: true }).click();
      await expect(component).not.toBeVisible();
    }
    await page.getByRole("button", { name: "Inspect Entitlements & quotas", exact: true }).click();
    await page.getByRole("button", { name: "Configure component", exact: true }).click();
    const component = page.getByRole("dialog", { name: "Configure component", exact: true });
    await expect(component.getByLabel("Limit enforcement", { exact: true })).toHaveValue(
      "Unspecified",
    );
    await page.screenshot({
      path: "test-results/p46-entitlements-light.png",
      animations: "disabled",
    });
    await page.setViewportSize({ width: 390, height: 844 });
    await component.getByRole("button", { name: "Cancel", exact: true }).click();
    await page.getByRole("button", { name: "Dark mode", exact: true }).click();
    await page.getByRole("button", { name: "Configure component", exact: true }).click();
    await page.screenshot({
      path: "test-results/p46-entitlements-dark.png",
      animations: "disabled",
    });
    expect(
      (await new AxeBuilder({ page }).include('[role="dialog"]').analyze()).violations,
    ).toEqual([]);
  } finally {
    if (id !== seed) await request.delete(`/api/projects/${id}`);
    await request.delete(`/api/projects/${seed}`);
  }
});

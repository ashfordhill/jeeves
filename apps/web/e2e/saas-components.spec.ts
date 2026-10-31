import { readFileSync } from "node:fs";
import AxeBuilder from "@axe-core/playwright";
import { type ApiPreview, type DesignDocument, plannedCapabilities } from "@jeeves/spec";
import { expect, test } from "./browser-test.ts";
import { editorAction, openNewProject } from "./helpers.ts";

const cases = [
  {
    id: "integration-adapter",
    host: "application-api",
    label: "Target external service",
    value: "Payment provider",
    key: "target",
  },
  {
    id: "notifications-module",
    host: "application-api",
    label: "Message templates",
    value: "Welcome, trial ending",
    key: "templates",
  },
  {
    id: "billing-module",
    host: "application-api",
    label: "Entitlements",
    value: "Team seats, monthly exports",
    key: "entitlements",
  },
  {
    id: "organizations-module",
    host: "application-api",
    label: "Team structure",
    value: "Organization with project teams",
    key: "teams",
  },
  {
    id: "developer-api-module",
    host: "application-api",
    label: "Versioning",
    value: "Header version",
    key: "versioning",
    choice: true,
  },
  {
    id: "reports-module",
    host: "background-worker",
    label: "Export formats",
    value: "CSV, JSON",
    key: "formats",
  },
  {
    id: "search-module",
    host: "background-worker",
    label: "Indexed documents",
    value: "Published links and tags",
    key: "documents",
  },
  {
    id: "scheduled-jobs-module",
    host: "background-worker",
    label: "Schedule",
    value: "Every day at 03:00",
    key: "schedule",
  },
  {
    id: "event-handlers-module",
    host: "background-worker",
    label: "Event contracts",
    value: "link.created@1",
    key: "events",
  },
  {
    id: "audit-log-module",
    host: "background-worker",
    label: "Audited actions",
    value: "Role changes and exports",
    key: "actions",
  },
  {
    id: "screen-group",
    host: "browser-client",
    label: "Pages",
    value: "Library, Studio, Analytics",
    key: "pages",
  },
  {
    id: "client-session",
    host: "browser-client",
    label: "Client access roles",
    value: "Owner, Member",
    key: "roles",
  },
  {
    id: "api-facade",
    host: "browser-client",
    label: "Target application API",
    value: "Management API",
    key: "target",
  },
  {
    id: "local-state",
    host: "mobile-client",
    label: "Locally retained data",
    value: "Draft links and pending artwork",
    key: "data",
  },
];

for (const scenario of cases) {
  const family = plannedCapabilities.find((item) => item.id === scenario.id)!;
  test(`${family.name} is authored on ${scenario.host} with labeled dependency, options and history`, async ({
    page,
    request,
  }) => {
    const id = await openNewProject(page, request, `P42 ${scenario.id}`);
    const read = async (): Promise<DesignDocument> =>
      (await (await request.get(`/api/projects/${id}/design`)).json()).design;
    const components = () => page.getByRole("button", { name: "C3 Components", exact: true });
    try {
      expect(
        (
          await request.post(`/api/projects/${id}/operations`, {
            data: {
              baseRevision: 0,
              ops: [
                {
                  op: "addElement",
                  element: {
                    id: "host",
                    name: "Customer application",
                    template: null,
                    planned: scenario.host,
                  },
                },
                {
                  op: "addElement",
                  element: {
                    id: "provider",
                    name: "Provider",
                    template: null,
                    planned: "third-party-service",
                    technology: "Provider API",
                    description: "Delivers provider operations.",
                  },
                },
                {
                  op: "connect",
                  connection: {
                    id: "provider-use",
                    kind: "depends-on",
                    from: { element: "host" },
                    to: { element: "provider" },
                    planned: {
                      label: "Synchronizes provider records",
                      protocol: "HTTPS/JSON",
                      interaction: "Request / response",
                      security: "Service identity",
                    },
                  },
                },
              ],
            },
          })
        ).status(),
      ).toBe(200);
      await page.reload();
      await components().click();
      await page.getByLabel("Component container").selectOption("host");
      await page.getByRole("button", { name: "Library", exact: true }).click();
      const library = page.getByRole("dialog", { name: "Architecture library" });
      await library.getByRole("button", { name: family.group, exact: true }).click();
      const expected = plannedCapabilities
        .filter(
          (item) =>
            item.scope === "component" &&
            (family.role === "frontend" ? item.role === "frontend" : item.role !== "frontend"),
        )
        .map((item) => item.name);
      expect(await library.locator(".catalog-card strong").allTextContents()).toEqual(expected);
      await library.getByRole("textbox", { name: "Search building blocks" }).fill(scenario.label);
      await library
        .locator(".catalog-card")
        .filter({ has: page.getByText(family.name, { exact: true }) })
        .click();
      const dialog = page.getByRole("dialog", { name: "Add component", exact: true });
      const fill = async () => {
        await dialog.getByLabel("Component name", { exact: true }).fill(family.name);
        await dialog.getByLabel("Responsibility", { exact: true }).fill(family.description);
        await dialog.getByLabel("Technology", { exact: true }).fill("Feature facade");
        if (scenario.choice)
          await dialog.getByLabel(scenario.label, { exact: true }).selectOption(scenario.value);
        else await dialog.getByLabel(scenario.label, { exact: true }).fill(scenario.value);
        await dialog.getByLabel("Uses connected applications / stores", { exact: true }).click();
        await page
          .getByRole("option", { name: "Synchronizes provider records · Provider", exact: true })
          .click();
        await dialog.getByRole("heading", { name: "Add component", exact: true }).click();
      };
      expect(
        await dialog
          .getByLabel("Component type", { exact: true })
          .locator("option")
          .allTextContents(),
      ).toEqual(["Group existing capabilities", ...expected.map((name) => `${name} · planned`)]);
      const before = await read();
      await fill();
      await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
      await expect(dialog).not.toBeVisible();
      expect(await read()).toEqual(before);
      await page.getByRole("button", { name: "Library", exact: true }).click();
      await library.getByRole("textbox", { name: "Search building blocks" }).fill(family.name);
      await library
        .locator(".catalog-card")
        .filter({ has: page.getByText(family.name, { exact: true }) })
        .click();
      await fill();
      expect(
        (await new AxeBuilder({ page }).include('[role="dialog"]').analyze()).violations,
      ).toEqual([]);
      await dialog.getByLabel("Component name", { exact: true }).scrollIntoViewIfNeeded();
      await page.screenshot({
        path: `test-results/p42-${scenario.id}-options.png`,
        animations: "disabled",
      });
      await dialog.getByRole("button", { name: "Save component", exact: true }).click();
      await expect(dialog).not.toBeVisible();
      await expect.poll(async () => (await read()).revision).toBe(before.revision + 1);
      const saved = await read();
      expect(saved.architecture?.components).toHaveLength(1);
      expect(saved.architecture!.components![0]).toMatchObject({
        name: family.name,
        capability: scenario.id,
        technology: "Feature facade",
        responsibility: family.description,
        config: { [scenario.key]: scenario.value },
        usesConnections: ["provider-use"],
      });
      const card = page.getByRole("button", { name: `Inspect ${family.name}`, exact: true });
      await expect(card).toBeVisible();
      await expect(card.locator(".architecture-card-technology")).toHaveText("Feature facade");
      await expect(
        page.getByRole("button", {
          name: "Inspect relationship: Synchronizes provider records",
          exact: true,
        }),
      ).toContainText("HTTPS/JSON");
      await page.getByRole("button", { name: "Undo", exact: true }).click();
      await expect.poll(async () => (await read()).architecture?.components ?? []).toEqual([]);
      await page.getByRole("button", { name: "Redo", exact: true }).click();
      await expect.poll(async () => (await read()).architecture).toEqual(saved.architecture);
      await page.reload();
      await components().click();
      await page.getByLabel("Component container").selectOption("host");
      await expect(card).toBeVisible();
      await card.click();
      await page.getByRole("button", { name: "Configure component", exact: true }).click();
      const edit = page.getByRole("dialog", { name: "Configure component", exact: true });
      await expect(edit.getByLabel(scenario.label, { exact: true })).toHaveValue(scenario.value);
      await expect(edit.getByLabel("Technology", { exact: true })).toHaveValue("Feature facade");
      await edit.getByRole("button", { name: "Cancel", exact: true }).click();
      await expect(edit).not.toBeVisible();
      await editorAction(page, "Hide inspector");
      await page.getByRole("button", { name: "Fit View", exact: true }).click();
      expect(
        (await new AxeBuilder({ page }).include(".integrated-editor").analyze()).violations,
      ).toEqual([]);
      await page.screenshot({
        path: `test-results/p42-${scenario.id}-light.png`,
        animations: "disabled",
      });
      await page.setViewportSize({ width: 390, height: 844 });
      await page.getByRole("button", { name: "Dark mode", exact: true }).click();
      await page.getByRole("button", { name: "Fit View", exact: true }).click();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      );
      expect(
        (await new AxeBuilder({ page }).include(".integrated-editor").analyze()).violations,
      ).toEqual([]);
      await page.screenshot({
        path: `test-results/p42-${scenario.id}-dark.png`,
        animations: "disabled",
      });
      expect((await read()).architecture).toEqual(saved.architecture);
    } finally {
      await request.delete(`/api/projects/${id}`);
    }
  });
}

test("QR operations remain unique with technical components hidden and mouse toggle never edits the design", async ({
  page,
  request,
}) => {
  const fixture: DesignDocument = JSON.parse(
    readFileSync(
      new URL("../../../fixtures/designs/qrwty-architecture.json", import.meta.url),
      "utf8",
    ),
  );
  const id = await openNewProject(page, request, "P42 QR technical visibility");
  const read = async (): Promise<DesignDocument> =>
    (await (await request.get(`/api/projects/${id}/design`)).json()).design;
  try {
    expect(
      (
        await request.post(`/api/projects/${id}/operations`, {
          data: {
            baseRevision: 0,
            ops: [
              ...fixture.elements.map((element) => ({ op: "addElement", element })),
              ...fixture.connections.map((connection) => ({ op: "connect", connection })),
              { op: "setArchitecture", architecture: fixture.architecture },
            ],
          },
        })
      ).status(),
    ).toBe(200);
    await page.reload();
    const before = await read();
    await page.getByRole("button", { name: "C3 Components", exact: true }).click();
    await page.getByLabel("Component container").selectOption("qrwty");
    const graph = page.getByRole("region", { name: "components diagram", exact: true });
    await expect(graph).toHaveAttribute("aria-busy", "false");
    await expect(
      page.getByRole("button", { name: "Inspect HTTP resource boundary", exact: true }),
    ).toHaveCount(0);
    const operations: string[] = [];
    for (const component of fixture.architecture!.components!.filter(
      (item) => item.element === "qrwty",
    )) {
      await page.getByRole("button", { name: `Inspect ${component.name}`, exact: true }).click();
      operations.push(
        ...(await page.locator(".component-operation .endpoint-line").allTextContents()),
      );
    }
    const preview: ApiPreview = await (await request.get(`/api/projects/${id}/api-preview`)).json();
    expect(operations.sort()).toEqual(
      preview.apis
        .find((api) => api.element === "qrwty")!
        .operations.map((operation) => `${operation.method} ${operation.path}`)
        .sort(),
    );
    expect(new Set(operations).size).toBe(operations.length);
    const toggle = async (checked: boolean) => {
      await page.getByRole("button", { name: "Editor actions", exact: true }).click();
      const control = page.getByRole("menuitemcheckbox", {
        name: "Show technical components",
        exact: true,
      });
      await expect(control).toHaveAttribute("aria-checked", String(checked));
      await control.click();
    };
    await toggle(false);
    await expect(
      page.getByRole("button", { name: "Inspect HTTP resource boundary", exact: true }),
    ).toBeVisible();
    await page.getByLabel("Component container").selectOption("qrwty-web");
    await expect(
      page.getByRole("button", { name: "Inspect Typed API adapter", exact: true }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Library", exact: true }).click();
    const library = page.getByRole("dialog", { name: "Architecture library" });
    await library.getByRole("button", { name: "Client components", exact: true }).click();
    expect(await library.locator(".catalog-card strong").allTextContents()).toEqual([
      "Screen group / feature area",
      "Client session & access",
      "API facade",
      "Local state & offline sync",
    ]);
    await library.getByRole("button", { name: "Close architecture library", exact: true }).click();
    await toggle(true);
    await expect(
      page.getByRole("button", { name: "Inspect Typed API adapter", exact: true }),
    ).toHaveCount(0);
    await page.getByLabel("Component container").selectOption("qrwty");
    await editorAction(page, "Hide inspector");
    await page.getByRole("button", { name: "Fit View", exact: true }).click();
    await page.screenshot({ path: "test-results/p42-qr-light.png", animations: "disabled" });
    expect(
      (await new AxeBuilder({ page }).include(".integrated-editor").analyze()).violations,
    ).toEqual([]);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByRole("button", { name: "Dark mode", exact: true }).click();
    await page.getByRole("button", { name: "Fit View", exact: true }).click();
    await page.screenshot({ path: "test-results/p42-qr-dark.png", animations: "disabled" });
    expect(
      (await new AxeBuilder({ page }).include(".integrated-editor").analyze()).violations,
    ).toEqual([]);
    expect(await read()).toEqual(before);
    await page.reload();
    await page.getByRole("button", { name: "C3 Components", exact: true }).click();
    await page.getByLabel("Component container").selectOption("qrwty");
    await expect(
      page.getByRole("button", { name: "Inspect HTTP resource boundary", exact: true }),
    ).toHaveCount(0);
  } finally {
    await request.delete(`/api/projects/${id}`);
  }
});

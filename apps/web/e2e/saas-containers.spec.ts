import AxeBuilder from "@axe-core/playwright";
import type { DesignDocument } from "@jeeves/spec";
import { expect, test } from "./browser-test.ts";
import { editorAction, inspectObject, openNewProject } from "./helpers.ts";

const cases = [
  {
    id: "third-party-service",
    name: "Third-party service",
    group: "Integrations",
    query: "SMS",
    family: "external",
    technology: "Provider HTTPS API",
    description: "Delivers verification messages through an external provider.",
    choices: {
      Category: "SMS",
      Authentication: "OAuth client",
      "Behavior when unavailable": "Queue and retry",
    },
    text: { "Data shared": "Phone number and verification message" },
    numbers: {},
    switches: ["Inbound webhooks"],
    config: {
      category: "SMS",
      authentication: "OAuth client",
      webhooks: true,
      dataShared: "Phone number and verification message",
      unavailable: "Queue and retry",
    },
  },
  {
    id: "analytics-store",
    name: "Analytics store / warehouse",
    group: "Data & storage",
    query: "Data lake",
    family: "data",
    technology: "Columnar SQL engine",
    description: "Stores daily usage aggregates for customer reports.",
    choices: {
      "Store family": "Time-series",
      Load: "Nightly batch",
      Access: "Customer-facing reports",
    },
    text: {},
    numbers: { "Retention target (days; 0 = indefinite)": "365" },
    switches: [],
    config: {
      family: "Time-series",
      load: "Nightly batch",
      retention: 365,
      access: "Customer-facing reports",
    },
  },
  {
    id: "serverless-function",
    name: "Serverless function",
    group: "Application",
    query: "Storage event",
    family: "worker",
    technology: "Node.js function",
    description: "Processes uploaded artwork after a storage event.",
    choices: { Trigger: "Storage event", "Cold-start tolerance": "Sub-second target" },
    text: {},
    numbers: { "Timeout target (seconds)": "60" },
    switches: [],
    config: { trigger: "Storage event", coldStart: "Sub-second target", timeoutSeconds: 60 },
  },
  {
    id: "browser-client",
    name: "Web application",
    group: "Clients",
    query: "Internal staff & admins",
    family: "client",
    technology: "React · server rendering",
    description: "Provides the internal administration console.",
    choices: {
      Audience: "Internal staff & admins",
      Kind: "Server-rendered site",
      Rendering: "Hybrid",
    },
    text: {},
    numbers: {},
    switches: [],
    config: {
      audience: "Internal staff & admins",
      kind: "Server-rendered site",
      rendering: "Hybrid",
    },
  },
];

for (const scenario of cases) {
  test(`${scenario.name} places from filtered search and saves options with Cancel, history and reload`, async ({
    page,
    request,
  }) => {
    const id = await openNewProject(page, request, `P41 ${scenario.id}`);
    const read = async (): Promise<DesignDocument> =>
      (await (await request.get(`/api/projects/${id}/design`)).json()).design;
    const details = page.getByRole("complementary", { name: "Architecture details" });
    const card = page.locator(`[data-element-id="${scenario.id}"]`);
    try {
      await page.getByRole("button", { name: "Library", exact: true }).click();
      const library = page.getByRole("dialog", { name: "Architecture library" });
      await library.getByRole("textbox", { name: "Search building blocks" }).fill(scenario.query);
      await library.getByRole("button", { name: scenario.group, exact: true }).click();
      const block = library
        .locator(".catalog-card")
        .filter({ has: page.getByText(scenario.name, { exact: true }) });
      await expect(block).toHaveAttribute("data-family", scenario.family);
      await expect(block.locator("svg")).toHaveCount(1);
      await library.getByRole("button", { name: "Implemented", exact: true }).click();
      await expect(block).toHaveCount(0);
      await expect(
        library.getByText("No matching blocks. Try another search or category."),
      ).toBeVisible();
      await library.getByRole("button", { name: scenario.group, exact: true }).click();
      await block.click();
      await page.locator(".react-flow__pane").click({ position: { x: 350, y: 220 } });
      await expect(card).toHaveAttribute("data-family", scenario.family);
      await expect(card.locator(".element-card-stereotype")).toHaveText(
        scenario.family === "external" ? "External system" : "Container",
      );
      await expect(card).toHaveClass(scenario.family === "data" ? /database-card/ : /planned-card/);
      await inspectObject(page, `container:${scenario.id}`);
      const before = await read();
      const configure = async () => {
        await details.getByLabel("Description", { exact: true }).fill(scenario.description);
        await details.getByLabel("Technology", { exact: true }).fill(scenario.technology);
        for (const [label, value] of Object.entries(scenario.choices))
          await details.getByLabel(label, { exact: true }).selectOption(value);
        for (const [label, value] of Object.entries({ ...scenario.text, ...scenario.numbers }))
          await details.getByLabel(label, { exact: true }).fill(value);
        for (const label of scenario.switches)
          await details.getByRole("switch", { name: label, exact: true }).check();
      };
      await configure();
      await details.getByRole("button", { name: "Cancel", exact: true }).click();
      await expect(details.getByLabel("Technology", { exact: true })).toHaveValue("");
      expect(await read()).toEqual(before);
      await configure();
      await details.getByRole("button", { name: "Save options", exact: true }).click();
      await expect.poll(async () => (await read()).revision).toBe(before.revision + 1);
      const saved = await read();
      expect(saved.elements[0]).toMatchObject({
        planned: scenario.id,
        template: null,
        technology: scenario.technology,
        description: scenario.description,
        config: scenario.config,
      });
      await page.getByRole("button", { name: "Undo", exact: true }).click();
      await expect(details.getByLabel("Technology", { exact: true })).toHaveValue("");
      expect((await read()).elements).toEqual(before.elements);
      await page.getByRole("button", { name: "Redo", exact: true }).click();
      await expect.poll(async () => (await read()).elements).toEqual(saved.elements);
      await page.reload();
      await inspectObject(page, `container:${scenario.id}`);
      await expect(details.getByLabel("Technology", { exact: true })).toHaveValue(
        scenario.technology,
      );
      for (const [label, value] of Object.entries(scenario.choices))
        await expect(details.getByLabel(label, { exact: true })).toHaveValue(value);
      await expect(
        details.getByRole("button", { name: "Save options", exact: true }),
      ).toBeDisabled();
      await page.getByRole("button", { name: "Fit View", exact: true }).click();
      await expect(card.locator(".element-card-technology")).toHaveText(scenario.technology);
      await expect(card.locator(".container-description")).toHaveText(scenario.description);
      expect(
        (await new AxeBuilder({ page }).include(".integrated-editor").analyze()).violations,
      ).toEqual([]);
      await page.screenshot({
        path: `test-results/p41-${scenario.id}-options.png`,
        animations: "disabled",
      });
      await editorAction(page, "Hide inspector");
      await page.getByRole("button", { name: "Fit View", exact: true }).click();
      await page.screenshot({
        path: `test-results/p41-${scenario.id}-light.png`,
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
        path: `test-results/p41-${scenario.id}-dark.png`,
        animations: "disabled",
      });
      expect((await read()).elements).toEqual(saved.elements);
    } finally {
      await request.delete(`/api/projects/${id}`);
    }
  });
}

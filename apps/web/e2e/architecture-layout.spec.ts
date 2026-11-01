import { readFileSync } from "node:fs";
import AxeBuilder from "@axe-core/playwright";
import {
  legacyArchitectureExample as architectureExample,
  type DesignDocument,
  type LayoutDocument,
} from "@jeeves/spec";
import type { Page } from "@playwright/test";
import { expect, test } from "./browser-test.ts";
import { diagramAction, editorAction, inspectObject, openNewProject } from "./helpers.ts";

test.use({ actionTimeout: 10_000 });

async function clearRelationships(page: Page) {
  const graph = page.locator(".architecture-graph");
  await expect(graph).toHaveAttribute("aria-busy", "false");
  await expect(graph.locator(".architecture-card").first()).toBeVisible();
  const collisions = await graph.evaluate((root) => {
    const cards = [...root.querySelectorAll(".architecture-card")].map((node) =>
      node.getBoundingClientRect(),
    );
    return [...root.querySelectorAll(".architecture-relation-label")].flatMap((node) => {
      const label = node.getBoundingClientRect();
      return cards.some(
        (card) =>
          label.left < card.right - 1 &&
          label.right > card.left + 1 &&
          label.top < card.bottom - 1 &&
          label.bottom > card.top + 1,
      )
        ? [node.textContent]
        : [];
    });
  });
  expect(collisions).toEqual([]);
}

test("actual starter routes reserve labels and inspection preserves semantic data, board positions and camera", async ({
  page,
  request,
}) => {
  const created = await request.post("/api/projects/from-starter", {
    data: {
      name: "Fieldwork architecture",
      starter: { id: "resource-workspace", version: "0.1.0" },
    },
  });
  expect(created.status()).toBe(201);
  const id = (await created.json()).project.id;
  const read = async (path: string) => (await request.get(`/api/projects/${id}/${path}`)).json();
  const design = await read("design"),
    layout = await read("layout");
  try {
    await page.goto(`/?project=${id}#/draw`);
    await page.getByRole("button", { name: "C1 Context", exact: true }).click();
    const levels = page.getByRole("navigation", { name: "Architecture levels" });
    await levels.getByRole("button", { name: /Components/ }).click();
    await page.getByLabel("Component container").selectOption("inventory");
    // This route/geometry check intentionally inspects the full technical projection.
    await page.getByRole("button", { name: "Editor actions", exact: true }).click();
    await page
      .getByRole("menuitemcheckbox", { name: "Show technical components", exact: true })
      .click();
    await clearRelationships(page);
    await expect(page.locator(".architecture-card")).toHaveCount(6);
    await expect(page.locator(".architecture-relation-label")).toHaveCount(2);
    await page.getByRole("button", { name: "Inspect Accounts and sessions", exact: true }).click();
    await page.screenshot({ path: "test-results/p30-containers.png", animations: "disabled" });
    await page.getByRole("button", { name: "Zoom In", exact: true }).click();
    const viewport = page.locator(".architecture-graph .react-flow__viewport");
    const camera = await viewport.getAttribute("style");
    await inspectObject(page, "container:inventory-db");
    await expect(viewport).toHaveAttribute("style", camera ?? "");
    await inspectObject(page, "component:inventory:inventory-api:accounts");
    await editorAction(page, "Inspect evidence");
    const evidence = page.getByRole("dialog", { name: "Architecture evidence" });
    await evidence.getByRole("button", { name: "Refresh evidence", exact: true }).click();
    await expect(
      evidence.getByRole("button", { name: "Refresh evidence", exact: true }),
    ).toBeEnabled();
    await evidence.getByRole("button", { name: "Close evidence", exact: true }).click();
    await expect(viewport).toHaveAttribute("style", camera ?? "");
    await diagramAction(page, /^Flow (down|right)$/);
    await clearRelationships(page);
    await page.setViewportSize({ width: 1000, height: 850 });

    await page.getByRole("button", { name: "Fit View", exact: true }).click();
    await clearRelationships(page);
    await page.screenshot({ path: "test-results/p30-narrow.png", animations: "disabled" });
    expect(
      (await new AxeBuilder({ page }).include(".architecture-workspace").analyze()).violations,
    ).toEqual([]);
    await page.getByRole("button", { name: "Dark mode", exact: true }).click();
    await page.screenshot({ path: "test-results/p30-dark.png", animations: "disabled" });
    expect(
      (await new AxeBuilder({ page }).include(".architecture-workspace").analyze()).violations,
    ).toEqual([]);
    expect(await read("design")).toEqual(design);
    const savedLayout = await read("layout");
    expect(savedLayout.layout.items).toEqual(layout.layout.items);
    expect(savedLayout.layout.viewport).toEqual(layout.layout.viewport);
    expect(savedLayout.layout.architecture["components:inventory"].positions).toBeDefined();
  } finally {
    await request.delete(`/api/projects/${id}`);
  }
});

test("unavailable worker offers Retry and a real QR component scope renders independent responsibilities without fake links", async ({
  page,
  request,
}) => {
  await page.addInitScript(() => {
    const ActualWorker = window.Worker;
    Object.assign(window, { p30WorkerUnavailable: true });
    window.Worker = class extends ActualWorker {
      constructor(url: string | URL, options?: WorkerOptions) {
        if (
          String(url).includes("elk-worker") &&
          (window as unknown as { p30WorkerUnavailable: boolean }).p30WorkerUnavailable
        )
          throw new Error("Controlled fixture: worker construction unavailable");
        super(url, options);
      }
    };
  });
  const created = await request.post("/api/projects/from-recipe", {
    data: { name: "QR architecture layout", recipe: { id: "qr-studio", version: "0.1.0" } },
  });
  const id = (await created.json()).project.id;
  try {
    await page.goto(`/?project=${id}#/draw`);
    await page.getByRole("button", { name: "C1 Context", exact: true }).click();
    await expect(page.getByRole("alert")).toContainText("could not be arranged");
    await expect(page.locator(".architecture-card")).toHaveCount(0);
    await page.evaluate(() => Object.assign(window, { p30WorkerUnavailable: false }));
    await page.getByRole("button", { name: "Retry layout", exact: true }).click();
    await clearRelationships(page);
    await page
      .getByRole("navigation", { name: "Architecture levels" })
      .getByRole("button", { name: /Containers/ })
      .click();
    await inspectObject(page, "container:qrwty");
    await page.getByRole("button", { name: "Open components", exact: true }).click();
    await page.getByRole("button", { name: "Editor actions", exact: true }).click();
    await page
      .getByRole("menuitemcheckbox", { name: "Show technical components", exact: true })
      .click();
    await clearRelationships(page);
    await expect(page.locator(".architecture-card")).toHaveCount(13);
    await expect(page.locator(".architecture-relation-label")).toHaveCount(2);
    await page.screenshot({ path: "test-results/p30-components.png", animations: "disabled" });
    await inspectObject(page, "component:qrwty:qrwty-api:extension:owner-analytics");
    await diagramAction(page, "Focus selected object");
    await expect(
      page.getByRole("button", { name: "Inspect Owner analytics", exact: true }),
    ).toBeInViewport();
    expect(
      (await new AxeBuilder({ page }).include(".architecture-workspace").analyze()).violations,
    ).toEqual([]);
  } finally {
    await request.delete(`/api/projects/${id}`);
  }
});

test("P49 focused qrwty views retain layout, cameras and layout history with hidden dependency navigation", async ({
  page,
  request,
}) => {
  const id = await openNewProject(page, request, "P49 focused architecture");
  const { design, layout } = architectureExample("qrwty-target");
  const store = design.elements.find((element) => element.id === "db")!;
  design.elements.push(
    { ...structuredClone(store), id: "archive", name: "Archive" },
    { ...structuredClone(store), id: "audit-data", name: "Audit data" },
  );
  try {
    const save = await request.post(`/api/projects/${id}/operations`, {
      data: {
        baseRevision: 0,
        ops: [
          ...design.elements.map((element) => ({ op: "addElement", element })),
          ...design.connections.map((connection) => ({ op: "connect", connection })),
          { op: "setArchitecture", architecture: design.architecture },
        ],
      },
    });
    expect(save.status()).toBe(200);
    expect((await request.put(`/api/projects/${id}/layout`, { data: layout })).status()).toBe(200);
    const readDesign = async () =>
      (await (await request.get(`/api/projects/${id}/design`)).json()).design;
    const readLayout = async (): Promise<LayoutDocument> =>
      (await (await request.get(`/api/projects/${id}/layout`)).json()).layout;
    const before = await readDesign();
    await page.reload();
    await expect(page.locator(".element-card")).toHaveCount(16);
    await page.getByLabel("C2 view", { exact: true }).selectOption("focus-management");
    await clearRelationships(page);
    await page.screenshot({
      path: "test-results/p49-management-light.png",
      animations: "disabled",
    });
    await page.getByLabel("C2 view", { exact: true }).selectOption("focus-redirect");
    await clearRelationships(page);
    await expect(page.locator(".architecture-scope-frame")).toContainText(
      design.architecture!.system.name,
    );
    const visible = await page.locator(".architecture-card").count();
    expect(visible).toBeLessThan(16);
    await page.locator('[data-relation-id="connection:redirect-cache"]').click();
    await expect(page.locator(".architecture-selection-summary")).toContainText(
      "Looks up destinations",
    );
    await diagramAction(page, "Fit selected");
    await expect(page.getByRole("menu")).not.toBeVisible();
    await expect
      .poll(async () =>
        page
          .locator(".architecture-graph .react-flow__viewport")
          .evaluate((element) => new DOMMatrixReadOnly(getComputedStyle(element).transform).a),
      )
      .toBeGreaterThanOrEqual(0.65);
    await page.screenshot({ path: "test-results/p49-redirect-light.png", animations: "disabled" });
    expect(
      (await new AxeBuilder({ page }).include(".architecture-workspace").analyze()).violations,
    ).toEqual([]);
    await page.getByRole("button", { name: "Inspect Redirect service", exact: true }).click();
    await diagramAction(page, "Fit selected");
    const initial = (await readLayout()).architecture!["focus-redirect"]!.positions[
      "container:redirect"
    ]!;
    await diagramAction(page, "Nudge right");
    await expect
      .poll(
        async () =>
          (await readLayout()).architecture!["focus-redirect"]!.positions["container:redirect"]?.x,
      )
      .toBe(initial.x + 24);
    await diagramAction(page, "Undo layout");
    await expect
      .poll(
        async () =>
          (await readLayout()).architecture!["focus-redirect"]!.positions["container:redirect"]?.x,
      )
      .toBe(initial.x);
    await diagramAction(page, "Redo layout");
    await expect
      .poll(
        async () =>
          (await readLayout()).architecture!["focus-redirect"]!.positions["container:redirect"]?.x,
      )
      .toBe(initial.x + 24);
    const handle = page.locator(
      '.react-flow__node[data-id="container:redirect"] .architecture-drag-handle',
    );
    const box = await handle.boundingBox();
    expect(box).toBeTruthy();
    await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2);
    await page.mouse.down();
    await page.mouse.move(box!.x + box!.width / 2 + 45, box!.y + box!.height / 2 + 30, {
      steps: 6,
    });
    await page.mouse.up();
    await expect
      .poll(
        async () =>
          (await readLayout()).architecture!["focus-redirect"]!.positions["container:redirect"]?.x,
      )
      .toBeGreaterThan(initial.x + 24);
    await editorAction(page, "Hide inspector");
    await page.getByRole("button", { name: "Zoom In", exact: true }).click();
    const viewport = page.locator(".architecture-graph .react-flow__viewport");
    const camera = await viewport.getAttribute("style");
    await expect
      .poll(async () => (await readLayout()).architecture!["focus-redirect"]!.viewport)
      .toBeDefined();
    const moved = (await readLayout()).architecture!["focus-redirect"]!.positions;
    await page.getByRole("button", { name: "C1 Context", exact: true }).click();
    await clearRelationships(page);
    await page.getByRole("button", { name: "C2 Containers", exact: true }).click();
    await expect(viewport).toHaveAttribute("style", camera!);
    await page.reload();
    await page.getByLabel("C2 view", { exact: true }).selectOption("focus-redirect");
    await clearRelationships(page);
    await expect(viewport).toHaveAttribute("style", camera!);
    expect((await readLayout()).architecture!["focus-redirect"]!.positions).toEqual(moved);
    expect(await readDesign()).toEqual(before);
    expect((await readLayout()).items).toEqual(layout.items);
    await diagramAction(page, "Reset layout");
    await expect
      .poll(
        async () =>
          (await readLayout()).architecture!["focus-redirect"]!.positions["container:redirect"],
      )
      .toEqual(initial);
    await clearRelationships(page);
    await page.getByRole("button", { name: /hidden relationships/ }).click();
    const hidden = page.getByRole("dialog", { name: "Hidden relationships" });
    await expect(hidden).toContainText("relationships are outside Public redirect");
    await hidden.getByRole("button", { name: "Open whole system", exact: true }).click();
    await expect(page.locator(".element-card")).toHaveCount(16);
    await page.getByRole("button", { name: "New focused view", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "Focused C2 view", exact: true });
    await dialog.getByLabel("View name").fill("Owner management");
    await dialog.getByRole("checkbox", { name: "Owner web app", exact: true }).check();
    await dialog.getByRole("button", { name: "Save view", exact: true }).click();
    await clearRelationships(page);
    await expect(page.locator(".architecture-card")).toHaveCount(5);
    await page.getByRole("button", { name: "Edit view", exact: true }).click();
    await dialog.getByLabel("View name").fill("Discarded name");
    await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
    await expect(page.getByLabel("C2 view", { exact: true }).locator("option:checked")).toHaveText(
      "Owner management",
    );
    await page.getByLabel("C2 view", { exact: true }).selectOption("focus-analytics");
    await clearRelationships(page);
    await page.screenshot({ path: "test-results/p49-analytics-light.png", animations: "disabled" });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByRole("button", { name: "Dark mode", exact: true }).click();
    await page.getByRole("button", { name: "Edit view", exact: true }).click();
    await expect(dialog.getByRole("button", { name: "Save view", exact: true })).toBeInViewport();
    expect(
      (await new AxeBuilder({ page }).include('[role="dialog"]').analyze()).violations,
    ).toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.screenshot({ path: "test-results/p49-view-dark.png", animations: "disabled" });
    await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
    await page.screenshot({ path: "test-results/p49-analytics-dark.png", animations: "disabled" });
    await inspectObject(page, "connection:worker-analytics-data");
    await expect(page.locator(".architecture-selection-summary")).toContainText("visit aggregates");
    await page.screenshot({ path: "test-results/p49-selection-dark.png", animations: "disabled" });
    expect(
      (await new AxeBuilder({ page }).include(".architecture-workspace").analyze()).violations,
    ).toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    expect(await readDesign()).toEqual(before);
  } finally {
    await request.delete(`/api/projects/${id}`);
  }
});

test("P49 focused relationship contracts expand on selection and C3 retains its own saved camera", async ({
  page,
  request,
}) => {
  const id = await openNewProject(page, request, "P49 contract focus");
  const design = JSON.parse(
    readFileSync(
      new URL("../../../fixtures/designs/relationship-policies.json", import.meta.url),
      "utf8",
    ),
  ) as DesignDocument;
  try {
    const saved = await request.post(`/api/projects/${id}/operations`, {
      data: {
        baseRevision: 0,
        ops: [
          ...design.elements.map((element) => ({ op: "addElement", element })),
          ...design.connections.map((connection) => ({ op: "connect", connection })),
          { op: "setArchitecture", architecture: design.architecture },
        ],
      },
    });
    expect(saved.status()).toBe(200);
    await page.reload();
    await page.getByRole("button", { name: "New focused view", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "Focused C2 view", exact: true });
    await dialog.getByLabel("View name").fill("Lookup contracts");
    await dialog.getByRole("checkbox", { name: "Public redirect", exact: true }).check();
    await dialog.getByRole("button", { name: "Save view", exact: true }).click();
    await clearRelationships(page);
    const label = page.locator('[data-relation-id="connection:lookup-cache"]');
    await expect(label).toContainText("1 interface contract");
    await label.click();
    const binding = design.architecture!.bindings!.find(
      (binding) => binding.relationship.id === "lookup-cache",
    )!;
    const contract = design.architecture!.contracts!.find(
      (contract) => contract.id === binding.contract.id,
    )!;
    await expect(page.locator(".architecture-selection-summary")).toContainText(
      `${contract.name} · ${binding.contract.version}`,
    );
    await page.screenshot({ path: "test-results/p49-contract-light.png", animations: "disabled" });
    await page.getByRole("button", { name: "Inspect Public redirect", exact: true }).click();
    await page.getByRole("button", { name: "Open components", exact: true }).click();
    await clearRelationships(page);
    await page.getByRole("button", { name: "Zoom In", exact: true }).click();
    const camera = await page
      .locator(".architecture-graph .react-flow__viewport")
      .getAttribute("style");
    await page.getByLabel("Component container", { exact: true }).selectOption("management");
    await clearRelationships(page);
    await page.getByLabel("Component container", { exact: true }).selectOption("redirect");
    await clearRelationships(page);
    await expect(page.locator(".architecture-graph .react-flow__viewport")).toHaveAttribute(
      "style",
      camera!,
    );
    const read = async (): Promise<LayoutDocument> =>
      (await (await request.get(`/api/projects/${id}/layout`)).json()).layout;
    await expect
      .poll(async () => (await read()).architecture?.["components:redirect"]?.viewport)
      .toBeDefined();
    const positions = (await read()).architecture!["components:redirect"]!.positions;
    await page.reload();
    await page.getByRole("button", { name: "C3 Components", exact: true }).click();
    await page.getByLabel("Component container", { exact: true }).selectOption("redirect");
    await clearRelationships(page);
    await expect(page.locator(".architecture-graph .react-flow__viewport")).toHaveAttribute(
      "style",
      camera!,
    );
    expect((await read()).architecture!["components:redirect"]!.positions).toEqual(positions);
  } finally {
    await request.delete(`/api/projects/${id}`);
  }
});

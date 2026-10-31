import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";
import { expect, test } from "./browser-test.ts";

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
    await clearRelationships(page);
    await expect(page.locator(".architecture-card")).toHaveCount(6);
    await expect(page.locator(".architecture-relation-label")).toHaveCount(2);
    await page.getByRole("button", { name: "Inspect Accounts and sessions", exact: true }).click();
    await page.screenshot({ path: "test-results/p30-containers.png", animations: "disabled" });
    await page.getByRole("button", { name: "Zoom In", exact: true }).click();
    const viewport = page.locator(".architecture-graph .react-flow__viewport");
    const camera = await viewport.getAttribute("style");
    await page.getByLabel("Inspect an object").selectOption("container:inventory-db");
    await expect(viewport).toHaveAttribute("style", camera ?? "");
    await page
      .getByLabel("Inspect an object")
      .selectOption("component:inventory:inventory-api:accounts");
    await page.getByRole("button", { name: "Inspect evidence", exact: true }).click();
    const evidence = page.getByRole("dialog", { name: "Architecture evidence" });
    await evidence.getByRole("button", { name: "Refresh evidence", exact: true }).click();
    await expect(
      evidence.getByRole("button", { name: "Refresh evidence", exact: true }),
    ).toBeEnabled();
    await evidence.getByRole("button", { name: "Close evidence", exact: true }).click();
    await expect(viewport).toHaveAttribute("style", camera ?? "");
    await page.getByRole("button", { name: /^Flow (down|right)$/ }).click();
    await clearRelationships(page);
    await page.setViewportSize({ width: 1000, height: 850 });
    await page.getByRole("button", { name: "Chat", exact: true }).click();
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
    expect(await read("layout")).toEqual(layout);
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
    await page.getByLabel("Inspect an object").selectOption("container:qrwty");
    await page.getByRole("button", { name: "Open components", exact: true }).click();
    await clearRelationships(page);
    await expect(page.locator(".architecture-card")).toHaveCount(13);
    await expect(page.locator(".architecture-relation-label")).toHaveCount(2);
    await page.screenshot({ path: "test-results/p30-components.png", animations: "disabled" });
    await page
      .getByLabel("Inspect an object")
      .selectOption("component:qrwty:qrwty-api:extension:owner-analytics");
    await page.getByRole("button", { name: "Focus selected object", exact: true }).click();
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

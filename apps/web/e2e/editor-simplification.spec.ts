import { readFileSync } from "node:fs";
import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "./browser-test.ts";
import { editorAction, inspectObject, openNewProject } from "./helpers.ts";

test("empty context is explicit and mouse authoring saves, cancels, undoes and reloads", async ({
  page,
  request,
}) => {
  const id = await openNewProject(page, request, "P37 catalog");
  const read = async () => (await (await request.get(`/api/projects/${id}/design`)).json()).design;
  try {
    const before = await read();
    await page.getByRole("button", { name: "C1 Context", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Who uses P37 catalog?" })).toBeVisible();
    await expect(page.locator(".architecture-card")).toHaveCount(0);
    await page.screenshot({ path: "test-results/p37-empty-context.png", animations: "disabled" });
    await page.getByRole("button", { name: "Describe this system" }).click();
    const dialog = page.getByRole("dialog", { name: "Edit system context" });
    await dialog.getByLabel("System responsibility").fill("Discard this description");
    await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
    expect(await read()).toEqual(before);
    await page.getByRole("button", { name: "Describe this system" }).click();
    await dialog
      .getByLabel("System responsibility")
      .fill("Operators maintain a shared item catalog.");
    await dialog.getByRole("button", { name: "Add context object" }).click();
    await dialog.getByLabel("Object 1 name").fill("Catalog operator");
    await dialog.getByLabel("Object 1 responsibility").fill("Maintains catalog items.");
    await dialog.getByRole("button", { name: "Add interaction", exact: true }).click();
    await dialog.getByLabel("Interaction 1 purpose").fill("Manages catalog items");
    await dialog.getByRole("button", { name: "Save context", exact: true }).click();
    await expect(dialog).not.toBeVisible();
    await expect(
      page.getByRole("button", { name: "Inspect Catalog operator", exact: true }),
    ).toBeVisible();
    const saved = await read();
    expect(saved.revision).toBe(before.revision + 1);
    await page.getByRole("button", { name: "Undo", exact: true }).click();
    await expect(page.getByRole("button", { name: "Describe this system" })).toBeVisible();
    await page.getByRole("button", { name: "Redo", exact: true }).click();
    await page.reload();
    await page.getByRole("button", { name: "C1 Context", exact: true }).click();
    await expect(
      page.getByRole("region", { name: "context diagram", exact: true }),
    ).toHaveAttribute("aria-busy", "false");
    await page.getByRole("button", { name: "Inspect Catalog operator", exact: true }).click();
    const details = page.getByRole("complementary", { name: "Architecture details" });
    await expect(details.getByLabel("Responsibility", { exact: true })).toHaveValue(
      "Maintains catalog items.",
    );
    await page.screenshot({ path: "test-results/p37-context.png", animations: "disabled" });
    expect((await read()).architecture).toEqual(saved.architecture);
    expect(
      (await new AxeBuilder({ page }).include(".integrated-editor").analyze()).violations,
    ).toEqual([]);
    await editorAction(page, /^Findings/);
    await expect(page.getByRole("dialog", { name: "Findings" })).toContainText(
      "has no container binding",
    );
    await page.getByRole("button", { name: "Close findings" }).click();
  } finally {
    await request.delete(`/api/projects/${id}`);
  }
});

test("drawer and concise grouped details preserve pins, contracts, selection and drafts", async ({
  page,
  request,
}) => {
  const fixture = JSON.parse(
    readFileSync(
      new URL("../../../fixtures/designs/qrwty-architecture.json", import.meta.url),
      "utf8",
    ),
  );
  const id = await openNewProject(page, request, "P37 QR editor");
  const read = async () => (await (await request.get(`/api/projects/${id}/design`)).json()).design;
  try {
    expect(
      (
        await request.post(`/api/projects/${id}/operations`, {
          data: {
            baseRevision: 0,
            ops: [
              ...fixture.elements.map((element: unknown) => ({ op: "addElement", element })),
              ...fixture.connections.map((connection: unknown) => ({ op: "connect", connection })),
              { op: "setArchitecture", architecture: fixture.architecture },
            ],
          },
        })
      ).status(),
    ).toBe(200);
    await page.reload();
    const before = await read();
    const chat = page.getByRole("region", { name: "Design chat", exact: true });
    await expect(chat).not.toBeVisible();
    await page.getByRole("button", { name: "Open chat", exact: true }).click();
    await chat
      .getByRole("textbox", { name: "Message", exact: true })
      .fill("Keep this unsent design draft.");
    await page.getByRole("button", { name: "Collapse chat", exact: true }).click();
    await page.getByRole("button", { name: "C3 Components", exact: true }).click();
    await page.getByLabel("Component container").selectOption("qrwty");
    const graph = page.getByRole("region", { name: "components diagram", exact: true });
    await expect(graph).toHaveAttribute("aria-busy", "false");
    await page.getByRole("button", { name: "Inspect Analytics", exact: true }).click();
    const details = page.getByRole("complementary", { name: "Architecture details" });
    await expect(details.getByRole("heading", { name: "Analytics", exact: true })).toHaveCount(1);
    await expect(
      details.locator(".endpoint-line").filter({ hasText: "GET /api/analytics" }),
    ).toBeVisible();
    await expect(details.locator(".endpoint-response").first()).toContainText("application/json");
    await expect(details.getByText(/QR-\d/)).toHaveCount(0);
    await expect(details.getByText("Project implementation", { exact: true })).not.toBeVisible();
    await expect(
      page.getByRole("button", { name: "Inspect qrwty DB", exact: true }),
    ).toHaveAttribute("data-family", "data");
    await expect(
      page.getByRole("button", { name: "Inspect HTTP resource boundary", exact: true }),
    ).toHaveAttribute("data-family", "endpoint");
    await page.screenshot({ path: "test-results/p37-analytics.png", animations: "disabled" });
    await page.getByRole("button", { name: "Open chat", exact: true }).click();
    await expect(chat.getByRole("textbox", { name: "Message", exact: true })).toHaveValue(
      "Keep this unsent design draft.",
    );
    await page.screenshot({ path: "test-results/p37-chat.png", animations: "disabled" });
    await page.getByRole("button", { name: "Collapse chat", exact: true }).click();
    await page.getByRole("button", { name: "C2 Containers", exact: true }).click();
    await inspectObject(page, "container:qrwty");
    const subtype = details.getByLabel("Subtype of qrwty API", { exact: true });
    const originalPin = before.elements.find(
      (item: { id: string }) => item.id === "qrwty",
    ).template;
    await expect(subtype).toHaveValue(`${originalPin.id}@${originalPin.version}`);
    expect(await subtype.locator("option").allTextContents()).toEqual([
      "Choose subtype",
      "HTTP service",
      "Web app",
    ]);
    await subtype.selectOption({ label: "HTTP service" });
    await page.getByRole("button", { name: "Hide inspector", exact: true }).click();
    await page.locator('[data-element-id="qrwty"] .element-card-name').click();
    await expect(details).toBeVisible();
    await page.getByRole("button", { name: "Library", exact: true }).click();
    const library = page.getByRole("dialog", { name: "Architecture library" });
    await library.getByRole("textbox", { name: "Search building blocks" }).fill("HTTP service");
    await expect(library.locator(".catalog-card")).toHaveCount(1);
    await expect(library.locator(".catalog-card")).toHaveAttribute("data-family", "api");
    await expect(library.locator(".catalog-card")).not.toContainText(/0\.\d\.0/);
    await library.getByRole("button", { name: "Close architecture library" }).click();
    await page.getByRole("button", { name: "C1 Context", exact: true }).click();
    await expect(
      page.getByRole("region", { name: "context diagram", exact: true }),
    ).toHaveAttribute("aria-busy", "false");
    await page.screenshot({ path: "test-results/p37-qr-context.png", animations: "disabled" });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByRole("button", { name: "Dark mode", exact: true }).click();
    await expect(details).not.toBeVisible();
    await page.getByRole("button", { name: "Fit View", exact: true }).click();
    await page.screenshot({ path: "test-results/p37-mobile-dark.png", animations: "disabled" });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    expect(
      (await new AxeBuilder({ page }).include(".integrated-editor").analyze()).violations,
    ).toEqual([]);
    expect(await read()).toEqual(before);
  } finally {
    await request.delete(`/api/projects/${id}`);
  }
});

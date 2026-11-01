import AxeBuilder from "@axe-core/playwright";
import type { DesignDocument } from "@jeeves/spec";
import type { Page } from "@playwright/test";
import { expect, test } from "./browser-test.ts";
import { openNewProject } from "./helpers.ts";

async function capture(page: Page, name: string) {
  await page.getByRole("button", { name: "Fit View", exact: true }).click();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(
    (await new AxeBuilder({ page }).include(".integrated-editor").analyze()).violations,
  ).toEqual([]);
  await page.screenshot({ path: `test-results/p44-${name}.png`, animations: "disabled" });
}

test("chat plans C1, C2 and C3 from the library, with one-step undo, redo and reload", async ({
  page,
  request,
}) => {
  const id = await openNewProject(page, request, "P44 planned chat");
  const read = async (): Promise<DesignDocument> =>
    (await (await request.get(`/api/projects/${id}/design`)).json()).design;
  try {
    await page.getByRole("button", { name: "Open chat", exact: true }).click();
    const chat = page.getByRole("complementary", { name: "Chat panel" });
    await chat.getByRole("textbox", { name: "Message" }).fill("Plan an app like bit.ly");
    await chat.getByRole("button", { name: "Send", exact: true }).click();
    await expect(chat.getByText("Applied 6 changes as one undo step")).toBeVisible();
    await expect(chat.getByText(/These capabilities are design intent only/)).toBeVisible();
    const saved = await read();
    expect(saved.revision).toBe(1);
    expect(saved.elements.every((element) => element.planned && !element.template)).toBe(true);
    expect(saved.architecture?.components).toHaveLength(3);
    await capture(page, "chat-light");
    await chat.getByRole("button", { name: "Undo", exact: true }).click();
    await expect.poll(async () => (await read()).elements).toEqual([]);
    expect((await read()).architecture).toBeUndefined();
    await page.getByRole("button", { name: "Redo", exact: true }).click();
    await expect.poll(read).toEqual({ ...saved, revision: 3 });
    await page.reload();
    await expect(page.getByRole("toolbar", { name: "Drawing tools" })).toBeVisible();
    expect(await read()).toEqual({ ...saved, revision: 3 });
    if (await chat.isVisible())
      await page.getByRole("button", { name: "Collapse chat", exact: true }).click();
    for (const mode of ["light", "dark"] as const) {
      if (mode === "dark") {
        await page.setViewportSize({ width: 390, height: 844 });
        await page.getByRole("button", { name: "Dark mode", exact: true }).click();
      }
      await page.getByRole("button", { name: "C2 Containers", exact: true }).click();
      await expect(page.locator("[data-element-id]")).toHaveCount(3);
      await expect(
        page.locator(".connection-chip", { hasText: "Reads and writes links" }),
      ).toBeVisible();
      await capture(page, `c2-${mode}`);
      await page.getByRole("button", { name: "C1 Context", exact: true }).click();
      await expect(
        page.getByRole("region", { name: "context diagram", exact: true }),
      ).toHaveAttribute("aria-busy", "false");
      await expect(
        page.getByRole("button", { name: "Inspect Link owner", exact: true }),
      ).toBeVisible();
      await expect(page.locator(".architecture-card-technology")).toHaveCount(0);
      await capture(page, `c1-${mode}`);
      await page.getByRole("button", { name: "C3 Components", exact: true }).click();
      await page.getByLabel("Component container").selectOption("short-api");
      await expect(
        page.getByRole("region", { name: "components diagram", exact: true }),
      ).toHaveAttribute("aria-busy", "false");
      await expect(page.locator('.architecture-card[data-kind="component"]')).toHaveCount(3);
      await capture(page, `c3-${mode}`);
    }
    // A chat-authored responsibility uses the same mouse-only option editor as library blocks.
    await page.getByRole("button", { name: "Inspect Link management", exact: true }).click();
    const details = page.getByRole("complementary", { name: "Architecture details" });
    await details.getByRole("button", { name: "Configure component", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "Configure component", exact: true });
    await dialog.getByLabel("Owns / manages", { exact: true }).fill("Discard this draft");
    await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
    expect((await read()).revision).toBe(3);
    await details.getByRole("button", { name: "Configure component", exact: true }).click();
    await dialog
      .getByLabel("Owns / manages", { exact: true })
      .fill("Short links and custom aliases");
    expect(
      (await new AxeBuilder({ page }).include('[role="dialog"]').analyze()).violations,
    ).toEqual([]);
    await page.screenshot({
      path: "test-results/p44-component-options-dark.png",
      animations: "disabled",
    });
    await dialog.getByRole("button", { name: "Save component", exact: true }).click();
    await expect.poll(async () => (await read()).revision).toBe(4);
    await page.getByRole("button", { name: "Undo", exact: true }).click();
    await expect
      .poll(
        async () =>
          (await read()).architecture?.components?.find(
            (component) => component.id === "link-management",
          )?.config.owns,
      )
      .toBe("Short links");
    await page.getByRole("button", { name: "Redo", exact: true }).click();
    await expect
      .poll(
        async () =>
          (await read()).architecture?.components?.find(
            (component) => component.id === "link-management",
          )?.config.owns,
      )
      .toBe("Short links and custom aliases");
    await page.reload();
    expect(
      (await read()).architecture?.components?.find(
        (component) => component.id === "link-management",
      )?.config.owns,
    ).toBe("Short links and custom aliases");
  } finally {
    await request.delete(`/api/projects/${id}`);
  }
});

for (const product of ["qrwty", "inventory"] as const) {
  test(`P56 chat assembles the ${product} study using semantic stages and preserves open review through history`, async ({
    page,
    request,
  }) => {
    const id = await openNewProject(page, request, `P56 chat ${product}`);
    const read = async (): Promise<DesignDocument> =>
      (await (await request.get(`/api/projects/${id}/design`)).json()).design;
    try {
      await page.getByRole("button", { name: "Open chat", exact: true }).click();
      const chat = page.getByRole("complementary", { name: "Chat panel" });
      await chat.getByRole("textbox", { name: "Message" }).fill(`Assemble P56 ${product} study`);
      await chat.getByRole("button", { name: "Send", exact: true }).click();
      await expect(
        chat.getByText(
          /Production workload, SLO and recovery objectives remain unresolved owner decisions/,
        ),
      ).toBeVisible();
      await expect(chat.getByText(/Applied .* changes as one undo step/)).toBeVisible();
      await expect.poll(async () => (await read()).revision).toBe(1);
      const saved = await read();
      expect(saved.revision).toBe(1);
      expect(saved.architecture!.scenarios).toHaveLength(product === "qrwty" ? 6 : 3);
      expect(
        saved.architecture!.decisions!.find((d) => d.id === "production-objectives")!.status,
      ).toBe("Unresolved");
      expect(saved.elements.every((e) => e.template === null)).toBe(true);
      await page.screenshot({
        path: `test-results/p56-chat-${product}-light.png`,
        animations: "disabled",
      });
      await chat.getByRole("button", { name: "Undo", exact: true }).click();
      await expect.poll(async () => (await read()).elements).toEqual([]);
      await page.getByRole("button", { name: "Redo", exact: true }).click();
      await expect.poll(async () => (await read()).architecture).toEqual(saved.architecture);
      await page.reload();
      expect((await read()).architecture).toEqual(saved.architecture);
    } finally {
      await page.getByRole("tab", { name: "Runs", exact: true }).click();
      await page.waitForLoadState("networkidle");
      await request.delete(`/api/projects/${id}`);
    }
  });
}

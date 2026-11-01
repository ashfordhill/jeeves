import AxeBuilder from "@axe-core/playwright";
import { architectureExample, architectureExamples, type DesignDocument } from "@jeeves/spec";
import type { Page } from "@playwright/test";
import { expect, test } from "./browser-test.ts";
import { openNewProject } from "./helpers.ts";

async function settled(page: Page, level: "context" | "components") {
  await expect(page.getByRole("region", { name: `${level} diagram`, exact: true })).toHaveAttribute(
    "aria-busy",
    "false",
  );
}
async function capture(page: Page, name: string) {
  await page.getByRole("button", { name: "Fit View", exact: true }).click();
  await expect
    .poll(async () => {
      const graph = page.locator(".integrated-editor .react-flow").last();
      const area = await graph.boundingBox();
      if (!area) return false;
      for (const node of await graph
        .locator(".react-flow__node, .architecture-relation-label, .connection-chip, .context-chip")
        .all()) {
        const box = await node.boundingBox();
        if (
          !box ||
          box.x < area.x - 1 ||
          box.y < area.y - 1 ||
          box.x + box.width > area.x + area.width + 1 ||
          box.y + box.height > area.y + area.height + 1
        )
          return false;
      }
      return true;
    })
    .toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  if (name.endsWith("light")) {
    for (const card of await page.locator(".element-card").all()) {
      await expect(card.locator(".element-card-stereotype")).toBeVisible();
      await expect(card.locator(".element-card-technology")).toBeVisible();
      await expect(card.locator(".container-description")).toBeVisible();
    }
    for (const card of await page.locator(".architecture-card").all()) {
      await expect(card.locator(".architecture-card-kind")).toBeVisible();
      await expect(card.locator(".architecture-card-description")).toBeVisible();
      if ((await card.getAttribute("data-family")) === "data")
        expect(
          await card.evaluate((element) => getComputedStyle(element, "::before").content),
        ).not.toBe("none");
      if (!name.includes("-c1-"))
        await expect(card.locator(".architecture-card-technology")).toBeVisible();
    }
  }
  await page.screenshot({ path: `test-results/p43-${name}.png`, animations: "disabled" });
  expect(
    (await new AxeBuilder({ page }).include(".integrated-editor").analyze()).violations,
  ).toEqual([]);
}

for (const example of architectureExamples) {
  test(`${example.id} creates an independent editable example and navigates its C4 views by mouse`, async ({
    page,
    request,
  }) => {
    test.setTimeout(90_000);
    const seed = await openNewProject(page, request, `P43 chooser ${example.id}`);
    let id = seed;
    const fixture = architectureExample(example.id).design;
    const read = async (): Promise<DesignDocument> =>
      (await (await request.get(`/api/projects/${id}/design`)).json()).design;
    try {
      await page.getByRole("button", { name: "Explore SaaS examples", exact: true }).click();
      const library = page.getByRole("dialog", { name: "Architecture library" });
      const entry = library
        .locator(".catalog-example")
        .filter({ has: page.getByRole("heading", { name: example.name, exact: true }) });
      await expect(entry.locator("[data-preview-element]")).toHaveCount(fixture.elements.length);
      await expect(entry.locator("svg path")).toHaveCount(fixture.connections.length);
      if (example.id === "qrwty-target")
        await page.screenshot({ path: "test-results/p43-library.png", animations: "disabled" });
      const created = page.waitForResponse(
        (response) =>
          response.url().endsWith("/api/projects") && response.request().method() === "POST",
      );
      await entry
        .getByRole("button", { name: `Create ${example.name.toLowerCase()}`, exact: true })
        .click();
      id = (await (await created).json()).project.id;
      await expect(library).not.toBeVisible();
      expect(id).not.toBe(seed);
      expect((await read()).revision).toBe(1);
      expect((await read()).elements).toEqual(fixture.elements);
      await expect(page.locator("[data-element-id]")).toHaveCount(fixture.elements.length);
      await capture(page, `${example.id}-c2-light`);
      await page.getByRole("button", { name: "C1 Context", exact: true }).click();
      await settled(page, "context");
      await expect(page.locator(".architecture-card-technology")).toHaveCount(0);
      await capture(page, `${example.id}-c1-light`);
      await page.getByRole("button", { name: "C3 Components", exact: true }).click();
      const hosts = [
        ...new Set(fixture.architecture!.components!.map((component) => component.element)),
      ];
      for (const host of hosts) {
        await page.getByLabel("Component container").selectOption(host);
        await settled(page, "components");
        const count = fixture.architecture!.components!.filter(
          (component) => component.element === host,
        ).length;
        await expect(page.locator('.architecture-card[data-kind="component"]')).toHaveCount(count);
        await capture(page, `${example.id}-c3-${host}-light`);
      }
      // The target's configured component remains a normal draft with Cancel, one-step history and reload.
      if (example.id === "qrwty-target") {
        await page.getByLabel("Component container").selectOption("api");
        await settled(page, "components");
        await page
          .getByRole("button", { name: "Inspect Organizations & members", exact: true })
          .click();
        const details = page.getByRole("complementary", { name: "Architecture details" });
        await details.getByRole("button", { name: "Configure component", exact: true }).click();
        const dialog = page.getByRole("dialog", { name: "Configure component", exact: true });
        await dialog.getByLabel("Team structure", { exact: true }).fill("Discard this draft");
        await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
        expect((await read()).revision).toBe(1);
        await details.getByRole("button", { name: "Configure component", exact: true }).click();
        await dialog
          .getByLabel("Team structure", { exact: true })
          .fill("Teams with shared campaigns");
        await dialog.getByRole("button", { name: "Save component", exact: true }).click();
        await expect.poll(async () => (await read()).revision).toBe(2);
        await page.getByRole("button", { name: "Undo", exact: true }).click();
        await expect
          .poll(
            async () =>
              (await read()).architecture!.components!.find((item) => item.id === "organizations")!
                .config.teams,
          )
          .toBe("Organizations with shared link libraries");
        await page.getByRole("button", { name: "Redo", exact: true }).click();
        await expect
          .poll(
            async () =>
              (await read()).architecture!.components!.find((item) => item.id === "organizations")!
                .config.teams,
          )
          .toBe("Teams with shared campaigns");
        // Binding is editable on C1, separate from the application end of a relationship.
        await page.getByRole("button", { name: "C1 Context", exact: true }).click();
        await settled(page, "context");
        await page.getByRole("button", { name: "Inspect Payment provider", exact: true }).click();
        await details.getByLabel("External block on C2").selectOption("");
        await details.getByRole("button", { name: "Cancel", exact: true }).click();
        await expect(details.getByLabel("External block on C2")).toHaveValue("billing");
        await details.getByLabel("External block on C2").selectOption("");
        await details.getByRole("button", { name: "Save context", exact: true }).click();
        await expect
          .poll(
            async () =>
              (await read()).architecture!.nodes.find((node) => node.id === "payment-provider")!
                .container,
          )
          .toBeUndefined();
        await page.getByRole("button", { name: "Undo", exact: true }).click();
        await expect
          .poll(
            async () =>
              (await read()).architecture!.nodes.find((node) => node.id === "payment-provider")!
                .container,
          )
          .toBe("billing");
      }
      const saved = await read();
      await page.reload();
      expect(await read()).toEqual(saved);
      await page.setViewportSize({ width: 390, height: 844 });
      await page.getByRole("button", { name: "Dark mode", exact: true }).click();
      await page.getByRole("button", { name: "C2 Containers", exact: true }).click();
      await capture(page, `${example.id}-c2-dark`);
      await page.getByRole("button", { name: "C1 Context", exact: true }).click();
      await settled(page, "context");
      await capture(page, `${example.id}-c1-dark`);
      await page.getByRole("button", { name: "C3 Components", exact: true }).click();
      for (const host of hosts) {
        await page.getByLabel("Component container").selectOption(host);
        await settled(page, "components");
        await capture(page, `${example.id}-c3-${host}-dark`);
      }
      expect(await read()).toEqual(saved);
      expect(
        (await (await request.get(`/api/projects/${seed}/design`)).json()).design.elements,
      ).toEqual([]);
    } finally {
      if (id !== seed) await request.delete(`/api/projects/${id}`);
      await request.delete(`/api/projects/${seed}`);
    }
  });
}

import { readFileSync } from "node:fs";
import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "./browser-test.ts";
import { editorAction, openNewProject } from "./helpers.ts";

test.use({ actionTimeout: 10_000 });

test("planned SaaS examples, typed options and C4 scopes share one persistent editor", async ({
  page,
  request,
}) => {
  test.setTimeout(90_000);
  await page.setViewportSize({ width: 1440, height: 1000 });
  const seed = await openNewProject(page, request, "P36 example chooser");
  let id = seed;
  try {
    await expect(page.getByRole("region", { name: "Design chat", exact: true })).not.toBeVisible();
    await page.getByRole("button", { name: "Explore SaaS examples", exact: true }).click();
    const library = page.getByRole("dialog", { name: "Architecture library" });
    await expect(library.getByRole("heading", { name: "Social & content platform" })).toBeVisible();
    await page.screenshot({
      path: "test-results/p36-library-examples.png",
      animations: "disabled",
    });
    const created = page.waitForResponse(
      (response) =>
        response.url().endsWith("/api/projects") && response.request().method() === "POST",
    );
    await library
      .getByRole("button", { name: "Create community & discussion", exact: true })
      .click();
    id = (await (await created).json()).project.id;
    await expect(library).not.toBeVisible();
    await expect.poll(() => new URL(page.url()).searchParams.get("project")).toBe(id);
    expect(id).not.toBe(seed);
    const read = async () =>
      (await (await request.get(`/api/projects/${id}/design`)).json()).design;
    await expect(page.locator(".planned-card")).toHaveCount(14);
    await page.getByRole("button", { name: "Open chat", exact: true }).click();
    await page
      .getByRole("textbox", { name: "Message", exact: true })
      .fill("Keep the discussion service simple.");
    await page.locator('[data-element-id="cache"] .element-card-name').click();
    const details = page.getByRole("complementary", { name: "Architecture details" });
    await details.getByLabel("Default TTL (seconds)", { exact: true }).fill("600");
    await details.getByLabel("Traffic pattern", { exact: true }).selectOption("Bursty");
    await details.getByLabel("Peak workload target", { exact: true }).fill("5000");
    await page
      .getByRole("navigation", { name: "Architecture levels" })
      .getByRole("button", { name: "C1 Context" })
      .click();
    await expect(
      page.getByRole("region", { name: "context diagram", exact: true }),
    ).toHaveAttribute("aria-busy", "false");
    await page
      .getByRole("navigation", { name: "Architecture levels" })
      .getByRole("button", { name: "C2 Containers" })
      .click();
    await expect(page.getByRole("textbox", { name: "Message", exact: true })).toHaveValue(
      "Keep the discussion service simple.",
    );
    await expect(details.getByLabel("Default TTL (seconds)", { exact: true })).toHaveValue("600");
    const before = await read();
    await details.getByRole("button", { name: "Save options", exact: true }).click();
    await expect
      .poll(
        async () =>
          (await read()).elements.find((item: { id: string }) => item.id === "cache").config.ttl,
      )
      .toBe(600);
    expect((await read()).revision).toBe(before.revision + 1);
    expect(
      (await read()).elements.find((item: { id: string }) => item.id === "cache").config.peakRate,
    ).toBe(5000);
    await page.getByRole("button", { name: "Undo", exact: true }).click();
    await expect(details.getByLabel("Default TTL (seconds)", { exact: true })).toHaveValue("300");
    await page.getByRole("button", { name: "Redo", exact: true }).click();
    await expect(details.getByLabel("Default TTL (seconds)", { exact: true })).toHaveValue("600");
    await page.screenshot({ path: "test-results/p36-cache-options.png", animations: "disabled" });
    await page.locator('[data-element-id="api"] .element-card-name').click();
    await details.getByRole("button", { name: "Open components", exact: true }).click();
    await expect(
      page.getByRole("region", { name: "components diagram", exact: true }),
    ).toHaveAttribute("aria-busy", "false");
    await page.getByRole("button", { name: "Inspect Moderation", exact: true }).click();
    await details.getByRole("button", { name: "Configure component", exact: true }).click();
    const component = page.getByRole("dialog", { name: "Configure component", exact: true });
    await component
      .getByLabel("Review", { exact: true })
      .selectOption("Automated screening + review");
    await component.getByRole("button", { name: "Save component", exact: true }).click();
    await expect(component).not.toBeVisible();
    await expect
      .poll(
        async () =>
          (await read()).architecture.components.find(
            (item: { id: string }) => item.id === "moderation",
          ).config.review,
      )
      .toBe("Automated screening + review");
    await editorAction(page, "Connect components");
    const relationship = page.getByRole("dialog", { name: "Component relationship", exact: true });
    await relationship.getByLabel("From component").selectOption("content");
    await relationship.getByLabel("To component").selectOption("moderation");
    await relationship.getByLabel("Relationship label").fill("Submits reported content");
    await relationship.getByLabel("Protocol", { exact: true }).fill("In process");
    await relationship.getByLabel("Interaction", { exact: true }).selectOption("Asynchronous");
    await relationship.getByRole("button", { name: "Save relationship", exact: true }).click();
    await expect(relationship).not.toBeVisible();
    await expect(
      page.getByRole("button", { name: "Inspect relationship: Submits reported content" }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Inspect relationship: Submits reported content" })
      .click();
    await expect(details.getByRole("heading", { name: "Submits reported content" })).toBeVisible();
    const savedRelationship = (await read()).architecture.componentRelationships[0];
    expect(savedRelationship).toMatchObject({
      protocol: "In process",
      interaction: "Asynchronous",
    });
    await expect(
      page.locator(
        `.react-flow__edge[data-id="declared:${savedRelationship.id}"] .react-flow__edge-path`,
      ),
    ).toHaveCSS("stroke-dasharray", "7px, 4px");
    await page.screenshot({
      path: "test-results/p40-component-relationship.png",
      animations: "disabled",
    });
    await page.screenshot({
      path: "test-results/p36-community-components.png",
      animations: "disabled",
    });
    expect(
      (await new AxeBuilder({ page }).include(".integrated-editor").analyze()).violations,
    ).toEqual([]);
    await page.reload();
    await page
      .getByRole("navigation", { name: "Architecture levels" })
      .getByRole("button", { name: "C3 Components" })
      .click();
    await page.getByLabel("Component container").selectOption("api");
    await expect(
      page.getByRole("button", { name: "Inspect relationship: Submits reported content" }),
    ).toBeVisible();
    await page.setViewportSize({ width: 1000, height: 850 });
    await page.getByRole("button", { name: "Fit View", exact: true }).click();
    await page.screenshot({ path: "test-results/p36-medium.png", animations: "disabled" });
    await page.setViewportSize({ width: 390, height: 844 });

    await page.getByRole("button", { name: "Dark mode", exact: true }).click();
    await expect
      .poll(async () => {
        const box = await page
          .getByRole("button", { name: "Diagram options", exact: true })
          .boundingBox();
        return box ? box.x + box.width <= 390 : false;
      })
      .toBe(true);
    await page.getByRole("button", { name: "Fit View", exact: true }).click();
    await page.screenshot({ path: "test-results/p36-mobile-dark.png", animations: "disabled" });
    expect(
      (await new AxeBuilder({ page }).include(".integrated-editor").analyze()).violations,
    ).toEqual([]);
  } finally {
    if (id !== seed) await request.delete(`/api/projects/${id}`);
    await request.delete(`/api/projects/${seed}`);
  }
});

test("planned blocks and arrows are authored by mouse and a conflicting save retains the draft", async ({
  page,
  request,
  browserProblems,
}) => {
  test.setTimeout(60_000);
  const id = await openNewProject(page, request, "P36 mouse authoring");
  const read = async () => (await (await request.get(`/api/projects/${id}/design`)).json()).design;
  const details = page.getByRole("complementary", { name: "Architecture details" });
  try {
    await editorAction(page, "Show inspector");
    for (const [name, x] of [
      ["Application API", 190],
      ["Cache", 600],
    ] as const) {
      await page.getByRole("button", { name: "Library", exact: true }).click();
      const library = page.getByRole("dialog", { name: "Architecture library" });
      await library.getByRole("textbox", { name: "Search building blocks" }).fill(name);
      await library.locator(".catalog-card").getByText(name, { exact: true }).click();
      await page.locator(".react-flow__pane").click({ position: { x, y: 270 } });
    }
    await expect(page.locator(".planned-card")).toHaveCount(2);
    await page.getByRole("button", { name: "Connector", exact: true }).click();
    await page.locator(".planned-card .element-card-name").nth(0).click();
    await page.locator(".planned-card .element-card-name").nth(1).click();
    await page.getByRole("button", { name: "Select", exact: true }).click();
    await page.locator(".connection-chip").click();
    await details.getByLabel("Relationship label", { exact: true }).fill("Caches public responses");
    await details.getByLabel("Protocol", { exact: true }).fill("Cache protocol");
    const before = await read();
    await details.getByRole("button", { name: "Save relationship", exact: true }).click();
    await expect
      .poll(async () => (await read()).connections[0]?.planned.label)
      .toBe("Caches public responses");
    expect((await read()).revision).toBe(before.revision + 1);
    await page.locator(".planned-card .element-card-name").nth(1).click();
    await details.getByLabel("Default TTL (seconds)", { exact: true }).fill("999");
    await details.getByLabel("Operation", { exact: true }).selectOption("Externally operated");
    const current = await read();
    expect(
      (
        await request.post(`/api/projects/${id}/operations`, {
          data: {
            baseRevision: current.revision,
            ops: [{ op: "updateElement", id: current.elements[1].id, name: "Renamed elsewhere" }],
          },
        })
      ).status(),
    ).toBe(200);
    const conflict = browserProblems.expectHttp({
      scenario: "planned capability draft conflict",
      method: "POST",
      url: new URL(`/api/projects/${id}/operations`, page.url()).href,
      resourceType: "fetch",
      status: 409,
    });
    await details.getByRole("button", { name: "Save options", exact: true }).click();
    await expect(details.getByRole("alert")).toContainText("board was reloaded");
    await expect(details.getByLabel("Default TTL (seconds)", { exact: true })).toHaveValue("999");
    await expect(details.getByLabel("Operation", { exact: true })).toHaveValue(
      "Externally operated",
    );
    expect((await read()).elements[1].classification).toBeUndefined();
    expect((await read()).elements[1].config.ttl).toBeUndefined();
    conflict.finish();
    await details.getByRole("button", { name: "Cancel", exact: true }).click();
    await expect(details.getByLabel("Name", { exact: true })).toHaveValue("Renamed elsewhere");
    await expect(details.getByLabel("Default TTL (seconds)", { exact: true })).toHaveValue("300");
    await page.getByRole("button", { name: "C1 Context", exact: true }).click();
    await page.getByRole("button", { name: "Describe this system" }).click();
    await page
      .getByRole("dialog")
      .getByLabel("System responsibility")
      .fill("Serves public application requests.");
    await page.getByRole("dialog").getByRole("button", { name: "Save context" }).click();
    await page.getByRole("button", { name: "Inspect P36 mouse authoring", exact: true }).click();
    await details
      .getByLabel("Responsibility", { exact: true })
      .fill("Serves public application requests.");
    await details.getByRole("button", { name: "Save context", exact: true }).click();
    await expect
      .poll(async () => (await read()).architecture?.system.description)
      .toBe("Serves public application requests.");
    await expect(page.locator(".architecture-card-description")).toContainText([
      "Serves public application requests.",
    ]);
  } finally {
    await request.delete(`/api/projects/${id}`);
  }
});

test("QR architecture groups real operations and directly opens the bound resource editor", async ({
  page,
  request,
}) => {
  test.setTimeout(60_000);
  await page.setViewportSize({ width: 1440, height: 1000 });
  const fixture = JSON.parse(
    readFileSync(
      new URL("../../../fixtures/designs/qrwty-architecture.json", import.meta.url),
      "utf8",
    ),
  );
  const created = await request.post("/api/projects", { data: { name: "P36 QR architecture" } });
  const id = (await created.json()).project.id;
  try {
    const response = await request.post(`/api/projects/${id}/operations`, {
      data: {
        baseRevision: 0,
        ops: [
          ...fixture.elements.map((element: unknown) => ({ op: "addElement", element })),
          ...fixture.connections.map((connection: unknown) => ({ op: "connect", connection })),
          { op: "setArchitecture", architecture: fixture.architecture },
        ],
      },
    });
    expect(response.status()).toBe(200);
    await page.goto(`/?project=${id}#/draw`);
    await page
      .getByRole("navigation", { name: "Architecture levels" })
      .getByRole("button", { name: "C3 Components" })
      .click();
    await page.getByLabel("Component container").selectOption("qrwty");
    const graph = page.getByRole("region", { name: "components diagram", exact: true });
    await expect(graph).toHaveAttribute("aria-busy", "false");
    for (const name of [
      "Accounts and sessions",
      "QR management",
      "Redirect and scan recording",
      "Artwork",
      "Analytics",
    ])
      await expect(
        page.getByRole("button", { name: `Inspect ${name}`, exact: true }),
      ).toBeVisible();
    const details = page.getByRole("complementary", { name: "Architecture details" });
    await page.getByRole("button", { name: "Inspect Artwork", exact: true }).click();
    await expect(details.locator(".component-member")).toHaveCount(5);
    await page.getByRole("button", { name: "Inspect Analytics", exact: true }).click();
    await expect(details.locator(".component-member")).toHaveCount(2);
    await page.getByRole("button", { name: "Inspect QR management", exact: true }).click();
    await details.getByRole("button", { name: /^POST \/api\/qr / }).click();
    const api = page.getByRole("dialog", { name: "API contracts", exact: true });
    await api.getByRole("button", { name: "Configure resources", exact: true }).click();
    const resources = page.getByRole("dialog", { name: "Configure resources", exact: true });
    await expect(resources).toBeVisible();
    await resources.getByRole("button", { name: "Cancel", exact: true }).click();
    await api.getByRole("button", { name: "Close API contracts", exact: true }).click();
    await page.screenshot({ path: "test-results/p36-qr-components.png", animations: "disabled" });
    const clipped = await graph.evaluate((root) => {
      const frame = root.getBoundingClientRect();
      return [...root.querySelectorAll(".architecture-card, .architecture-relation-label")]
        .filter((node) => {
          const box = node.getBoundingClientRect();
          return (
            box.left < frame.left - 1 ||
            box.right > frame.right + 1 ||
            box.top < frame.top - 1 ||
            box.bottom > frame.bottom + 1
          );
        })
        .map((node) => node.textContent);
    });
    expect(clipped).toEqual([]);
    expect(
      (await new AxeBuilder({ page }).include(".integrated-editor").analyze()).violations,
    ).toEqual([]);
  } finally {
    await request.delete(`/api/projects/${id}`);
  }
});

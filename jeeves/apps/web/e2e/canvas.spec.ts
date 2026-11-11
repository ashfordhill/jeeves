import { buildStudioCommand, studioStoreAccess } from "@jeeves/spec";
import { commitSource, openDiagnostics, savedSource } from "./source.ts";
import {
  clickLine,
  createStudy,
  dashedLines,
  design,
  expect,
  lines,
  showView,
  test,
  tile,
  tiles,
} from "./studio.ts";

test("shows the TinyURL study on the lane canvas", async ({ page, tinyurl }) => {
  expect(new URL(page.url()).searchParams.get("project")).toBe(tinyurl);
  // The user, its two actions and eight tiles; the user's two lines, three lane entries and seven
  // connections, two dashed (publish and consume). The worker's store write is solid.
  // No CDN: Open link reaches the Redirect service
  // directly. Entry lines carry no chips: the action tiles say which lane they start.
  await expect(tiles(page)).toHaveCount(11);
  await expect(lines(page)).toHaveCount(12);
  await expect(dashedLines(page)).toHaveCount(2);
  await expect(page.locator(".board-line-arrow")).toHaveCount(12);
  // The legend shows only the dashed sample, Async; opened, it says what solid and dashed mean.
  const guide = page.locator(".lane-line-legend");
  await expect(guide.getByLabel("Line guide")).toHaveText("Async");
  await expect(guide.locator("summary svg [stroke-dasharray]")).toHaveCount(1);
  await guide.getByLabel("Line guide").click();
  await expect(guide).toContainText("Solid: a direct call; the caller waits");
  await expect(guide).toContainText("Dashed: sent through a queue or topic; nobody waits.");
  await expect(guide).toContainText("caller → target, including reads");
  await expect(guide).toContainText("publisher → channel → consumer");
  await expect(guide).not.toContainText("Request");
  await guide.getByLabel("Line guide").click();
  await expect(tile(page, "User")).toBeVisible();
  await expect(page.locator(".board-chip")).toHaveCount(0);
  // No design warnings in a study.
  await expect(page.locator(".board .lane-warning-mark")).toHaveCount(0);
  await expect(tile(page, "Open link").locator(".lane-action-name")).toHaveText("Open link");
  await expect(tile(page, "Shorten").locator(".lane-action-name")).toHaveText("Shorten");
  for (const name of [
    "Stats API",
    "Redirect service",
    "URL cache",
    "URL database",
    "Shorten service",
  ])
    await expect(tile(page, name)).toBeVisible();
  await expect(tile(page, "CDN")).toHaveCount(0);
});

test("New project offers the marketplace study", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(String(error)));
  const id = await createStudy(page, "E2E Marketplace", "Marketplace · studio study", "Simple");
  try {
    // The user, Browse and Buy & sell and seventeen tiles; the user's two lines, seven lane
    // entries (four upload) and fourteen connections, four dashed (publish and consume for
    // listing and paid-order events). Worker store writes stay solid.
    await expect(tiles(page)).toHaveCount(20);
    await expect(lines(page)).toHaveCount(23);
    await expect(dashedLines(page)).toHaveCount(4);
    await expect(page.locator(".board-line-arrow")).toHaveCount(23);
    await expect(page.locator(".board-chip")).toHaveCount(0);
    // No design warnings in a study.
    await expect(page.locator(".board .lane-warning-mark")).toHaveCount(0);
    for (const name of [
      "Browse",
      "Buy & sell",
      "Storefront API",
      "Image CDN",
      "Shop service",
      "Payments",
      "Cart service",
    ])
      await expect(tile(page, name)).toBeVisible();

    const inspector = page.locator(".studio-inspector");
    await tile(page, "Image CDN").click();
    await expect(inspector.getByLabel("Image resizing", { exact: true })).toHaveCount(0);
    expect(
      (await design(page, id)).architecture.studio.elements.find(
        (row) => row.element === "image-cdn",
      )?.settings.imageResizing,
    ).toBe("on-request");
    await tile(page, "Catalog database").click();
    await expect(inspector.getByLabel("Owner", { exact: true })).toHaveCount(0);
    const source = await savedSource(page);
    expect(
      source.architecture?.studio?.elements.find((row) => row.element === "catalog-db")?.owner,
    ).toEqual({ kind: "element", id: "shop" });
  } finally {
    await page.request.delete(`/api/projects/${id}`);
  }
  expect(errors).toEqual([]);
});

test("New project offers the YouTube study", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(String(error)));
  const id = await createStudy(page, "E2E YouTube", "YouTube · studio study", "Simple");
  try {
    // The user, Watch and Publish and eighteen tiles; the user's two lines, five lane entries
    // (none into storage: the Upload service writes Original videos) and eighteen connections,
    // seven dashed (the individual publish and consume links).
    await expect(tiles(page)).toHaveCount(21);
    await expect(lines(page)).toHaveCount(25);
    await expect(dashedLines(page)).toHaveCount(7);
    await expect(page.locator(".board-line-arrow")).toHaveCount(25);
    await expect(page.locator(".board-chip")).toHaveCount(0);
    // No design warnings in a study.
    await expect(page.locator(".board .lane-warning-mark")).toHaveCount(0);
    for (const name of [
      "Watch",
      "Publish",
      "Video delivery",
      "Watch API",
      "Search API",
      "Upload service",
      "Transcoder",
      "Completion events",
      "Completion handler",
      "Search indexer",
    ])
      await expect(tile(page, name)).toBeVisible();
    // Each tile's kind label: names leave the kind out, and a channel says Queue or Topic.
    for (const [name, label] of [
      ["Metadata", "Database"],
      ["Hot metadata", "Cache"],
      ["Videos", "Search index"],
      ["Video delivery", "CDN"],
      ["Upload jobs", "Queue"],
      ["Completion events", "Topic"],
      ["Transcoder", "Worker"],
      ["Watch API", "Service"],
    ] as const)
      await expect(tile(page, name).locator(".lane-tile-kind")).toHaveText(label);
    await expect(tile(page, "Watch").locator(".lane-tile-kind")).toHaveCount(0);
    await expect(tile(page, "User").locator(".lane-tile-kind")).toHaveCount(0);

    // One writer per store: the Upload service, the Completion handler, the Search indexer and
    // the Watch API (its own cache).
    const inspector = page.locator(".studio-inspector");
    const source = await savedSource(page);
    for (const [store, owner] of [
      ["originals", "upload"],
      ["metadata-db", "completion-handler"],
      ["search-index", "search-indexer"],
      ["metadata-cache", "watch"],
    ]) {
      expect(
        source.architecture?.studio?.elements.find((row) => row.element === store)?.owner,
      ).toEqual({ kind: "element", id: owner });
    }
    await tile(page, "Hot metadata").click();
    await expect(inspector.locator(".lane-store-access")).toHaveCount(0);
    // The Upload service is an Uploads service; its bytes travel by signed URLs.
    await tile(page, "Upload service").click();
    await expect(inspector.getByLabel("Transfer", { exact: true })).toHaveCount(0);
    expect(
      (await design(page, id)).architecture.studio.elements.find((row) => row.element === "upload")
        ?.settings.transfer,
    ).toBe("signed-url");

    // Select actual routes by mouse, including a returning store read. View-only interaction
    // must preserve the exact blueprint; removing and undoing the return still work by mouse.
    const before = await (await page.request.get(`/api/projects/${id}/blueprint`)).json();
    await clickLine(page, "transcoder-read");
    await expect(inspector.locator(".lane-connection-label")).toHaveText("Reads originals");
    await expect(
      inspector.getByRole("definition").filter({ hasText: "Request / response (solid)" }),
    ).toHaveCount(1);
    expect(studioStoreAccess(await savedSource(page), "transcoder-read")).toBe("read");
    const read = page.locator('.react-flow__edge[data-id="transcoder-read"]');
    await expect(read.locator(".react-flow__edge-path")).not.toHaveClass(/is-dashed/);
    await expect(read.locator(".board-line-arrow")).toHaveCount(1);
    expect(await (await page.request.get(`/api/projects/${id}/blueprint`)).json()).toEqual(before);
    await page
      .getByRole("button", { name: "Remove Transcoder to Original videos", exact: true })
      .click();
    await expect(read).toHaveCount(0);
    expect((await design(page, id)).connections.some((c) => c.id === "transcoder-read")).toBe(
      false,
    );
    await page.getByRole("button", { name: "Undo", exact: true }).click();
    await expect(read).toHaveCount(1);
    await clickLine(page, "jobs-transcoder");
    await expect(inspector).toContainText("Asynchronous (dashed)");
    await expect(inspector).toContainText("Channel → consumer");
    await clickLine(page, "counter-write");
    await expect(inspector).toContainText("Request / response (solid)");
    expect(studioStoreAccess(await savedSource(page), "counter-write")).toBe("write");
  } finally {
    await page.request.delete(`/api/projects/${id}`);
  }
  expect(errors).toEqual([]);
});

test("preserves inferred access in source and blueprint without exposing ineffective writer controls", async ({
  page,
  tinyurl: id,
}) => {
  // Written for the Simple view: one plain tile per element.
  await showView(page, "Simple");
  const inspector = page.locator(".studio-inspector");
  const before = await savedSource(page);
  await tile(page, "URL database").click();
  await expect(inspector.getByLabel("Owner", { exact: true })).toHaveCount(0);
  expect(studioStoreAccess(before, "redirect-db")).toBe("read");
  // The tile lists no connections in words; its relationships are the drawn lines.
  await expect(inspector.getByRole("button", { name: /→/ })).toHaveCount(0);
  await clickLine(page, "redirect-db");
  await expect(inspector.locator(".lane-connection-label")).toHaveText(
    "Reads links on a cache miss",
  );
  expect(await savedSource(page)).toEqual(before);
  await commitSource(page, (design) =>
    buildStudioCommand(design, {
      type: "edit",
      element: "url-db",
      owner: { kind: "element", id: "redirect" },
    }),
  );
  const changed = await savedSource(page);
  expect(studioStoreAccess(changed, "redirect-db")).toBe("write");
  const diagnostic = await openDiagnostics(page);
  await diagnostic.getByText("Full saved source", { exact: true }).click();
  await expect(diagnostic).toContainText('"id": "redirect"');
  await page.getByRole("button", { name: "Close source & diagnostics", exact: true }).click();
  const blueprint = await (await page.request.get(`/api/projects/${id}/blueprint`)).json();
  const of = (link: string) =>
    blueprint.connections.find((c: { id: string }) => c.id === link)?.access;
  expect([of("redirect-db"), of("shorten-db")]).toEqual(["write", "read"]);
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect
    .poll(async () => ({ ...(await savedSource(page)), revision: 0 }))
    .toEqual({ ...before, revision: 0 });
});

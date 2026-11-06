import { createStudy, dashedLines, expect, lines, test, tile, tiles } from "./studio.ts";

test("shows the TinyURL study on the lane canvas", async ({ page, tinyurl }) => {
  expect(new URL(page.url()).searchParams.get("project")).toBe(tinyurl);
  // The user, its two actions and eight tiles; the user's two lines, three lane entries and seven
  // connections, three dashed (the click path). No CDN: Open link reaches the Redirect service
  // directly. Entry lines carry no chips: the action tiles say which lane they start.
  await expect(tiles(page)).toHaveCount(11);
  await expect(lines(page)).toHaveCount(12);
  await expect(dashedLines(page)).toHaveCount(3);
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
  const id = await createStudy(page, "E2E Marketplace", "Marketplace · studio study");
  try {
    // The user, Browse and Buy & sell and seventeen tiles; the user's two lines, seven lane
    // entries (four upload) and fourteen connections, six of them dashed (the listing and
    // paid-order paths).
    await expect(tiles(page)).toHaveCount(20);
    await expect(lines(page)).toHaveCount(23);
    await expect(dashedLines(page)).toHaveCount(6);
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
    await inspector.getByRole("tab", { name: "Options", exact: true }).click();
    await expect(inspector.getByLabel("Image resizing", { exact: true })).toHaveValue("on-request");
    await tile(page, "Catalog database").click();
    await expect(inspector.locator(".lane-store-access")).toHaveText(
      "Writes (owner)Shop serviceReadsPayments",
    );
  } finally {
    await page.request.delete(`/api/projects/${id}`);
  }
  expect(errors).toEqual([]);
});

test("New project offers the YouTube study", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(String(error)));
  const id = await createStudy(page, "E2E YouTube", "YouTube · studio study");
  try {
    // The user, Watch and Publish and eighteen tiles; the user's two lines, five lane entries
    // (none into storage: the Upload service writes Original videos) and eighteen connections,
    // twelve of them dashed (the view path, and the upload pipeline after Upload jobs).
    await expect(tiles(page)).toHaveCount(21);
    await expect(lines(page)).toHaveCount(25);
    await expect(dashedLines(page)).toHaveCount(12);
    await expect(page.locator(".board-chip")).toHaveCount(0);
    // No design warnings in a study.
    await expect(page.locator(".board .lane-warning-mark")).toHaveCount(0);
    for (const name of [
      "Watch",
      "Publish",
      "Video CDN",
      "Watch API",
      "Search API",
      "Upload service",
      "Transcoder",
      "Completion events",
      "Completion handler",
      "Search indexer",
    ])
      await expect(tile(page, name)).toBeVisible();

    // One writer per store: the Upload service, the Completion handler, the Search indexer and
    // the Watch API (its own cache).
    const inspector = page.locator(".studio-inspector");
    const access = inspector.locator(".lane-store-access");
    await tile(page, "Original videos").click();
    await expect(access).toHaveText("Writes (owner)Upload serviceReadsTranscoder");
    await tile(page, "Metadata database").click();
    await expect(access).toHaveText("Writes (owner)Completion handlerReadsWatch API");
    await tile(page, "Search index").click();
    await expect(access).toHaveText("Writes (owner)Search indexerReadsSearch API");
    await tile(page, "Metadata cache").click();
    await expect(access).toHaveText("Writes (owner)Watch APIReadsnobody else");
    // The Upload service is an Uploads service; its bytes travel by signed URLs.
    await tile(page, "Upload service").click();
    await expect(
      inspector.getByRole("group", { name: "Type", exact: true }).getByRole("button", {
        name: "Uploads",
      }),
    ).toHaveAttribute("aria-pressed", "true");
    await inspector.getByRole("tab", { name: "Options", exact: true }).click();
    await expect(inspector.getByLabel("Transfer", { exact: true })).toHaveValue("signed-url");
  } finally {
    await page.request.delete(`/api/projects/${id}`);
  }
  expect(errors).toEqual([]);
});

test("shows each store's writer and readers, from its owner", async ({ page, tinyurl: id }) => {
  const inspector = page.locator(".studio-inspector");
  const access = inspector.locator(".lane-store-access");
  await tile(page, "URL database").click();
  await expect(access).toHaveText("Writes (owner)Shorten serviceReadsRedirect service");
  await inspector.getByRole("tab", { name: "Connections", exact: true }).click();
  await inspector.getByRole("button", { name: /^Redirect service → URL database/ }).click();
  await expect(inspector.locator(".lane-inspector-kind")).toHaveText("Reads");

  // Changing the owner changes who writes.
  await tile(page, "URL database").click();
  await inspector.getByRole("tab", { name: "General", exact: true }).click();
  await inspector
    .getByLabel("Owner", { exact: true })
    .selectOption({ label: "Redirect service · Application" });
  await expect(access).toHaveText("Writes (owner)Redirect serviceReadsShorten service");
  const res = await page.request.get(`/api/projects/${id}/blueprint`);
  const blueprint = await res.json();
  const of = (link: string) =>
    blueprint.connections.find((c: { id: string }) => c.id === link)?.access;
  expect([of("redirect-db"), of("shorten-db")]).toEqual(["write", "read"]);
});

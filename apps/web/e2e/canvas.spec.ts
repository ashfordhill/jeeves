import { dashedLines, expect, lines, test, tile, tiles } from "./studio.ts";

test("shows the TinyURL study on the lane canvas", async ({ page, tinyurl }) => {
  expect(new URL(page.url()).searchParams.get("project")).toBe(tinyurl);
  // The user and eight tiles; three lane entries and seven connections, three dashed (the click
  // path). No CDN: the user enters at the Redirect service directly.
  await expect(tiles(page)).toHaveCount(9);
  await expect(lines(page)).toHaveCount(10);
  await expect(dashedLines(page)).toHaveCount(3);
  await expect(tile(page, "User")).toBeVisible();
  await expect(page.locator(".board-chip")).toHaveCount(3);
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

import { design, expect, linePoint, lines, paperPoint, showView, test, tile } from "./studio.ts";

const colours = (page: Parameters<typeof lines>[0]) =>
  lines(page).evaluateAll((edges) =>
    Object.fromEntries(
      edges.map((edge) => [
        edge.getAttribute("data-id"),
        getComputedStyle(edge.querySelector(".board-wire-fill") as Element).stroke,
      ]),
    ),
  );

test("both views draw coloured wires, retain slots on reload and leave saved state unchanged", async ({
  page,
  tinyurl: id,
}) => {
  const blueprint = async () => (await page.request.get(`/api/projects/${id}/blueprint`)).json();
  const saved = async () => (await page.request.get(`/api/projects/${id}/design`)).json();
  const before = { designState: await saved(), blueprint: await blueprint() };
  const key = `jeeves.studio.ui.v1:${id}`;
  let slots: unknown;
  for (const view of ["Simple", "Detailed"] as const) {
    await showView(page, view);
    await expect(page.locator(".lane-canvas .board-wire-fill")).toHaveCount(12);
    await expect(page.locator(".lane-canvas .board-line-arrow")).toHaveCount(12);
    const tones = await colours(page);
    expect(new Set(Object.values(tones)).size).toBeGreaterThan(5);
    const saved = await page.evaluate(
      (key) => JSON.parse(localStorage.getItem(key) ?? "{}").wires,
      key,
    );
    expect(Object.keys(saved).length).toBeGreaterThan(3);
    if (slots) expect(saved).toEqual(slots);
    slots = saved;
    await page.reload();
    await showView(page, view);
    expect(await colours(page)).toEqual(tones);
    expect(
      await page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? "{}").wires, key),
    ).toEqual(slots);
  }
  const connected = page.locator(".lane-container-row-dot[data-connected]").first();
  await expect(connected).toBeVisible();
  expect(await connected.evaluate((el) => getComputedStyle(el).backgroundColor)).not.toBe(
    "rgb(18, 58, 80)",
  );
  const beforeSelection = await colours(page);
  await tile(page, "Redirect service").click();
  const selected = page.locator('.board-wire-edge[style*="--board-select"]');
  expect(await selected.count()).toBeGreaterThan(0);
  // Source colours survive tile selection; only the outlines change.
  expect(await colours(page)).toEqual(beforeSelection);
  expect({ designState: await saved(), blueprint: await blueprint() }).toEqual(before);
});

test("the pointer over a tile or a module's row picks out its wires, and over a wire nothing", async ({
  page,
  tinyurl: id,
}) => {
  const before = await design(page, id);
  await showView(page, "Simple");
  const wire = (line: string) => page.locator(`.react-flow__edge[data-id="${line}"] .board-wire`);
  // A wire under the pointer fades nothing.
  const at = await linePoint(page, "redirect-db");
  await page.mouse.move(at.x, at.y);
  await expect(wire("shorten-db")).toHaveCSS("opacity", "1");
  // A tile picks out the wires that leave or enter it, under the arrow, not a hand.
  const redirect = tile(page, "Redirect service");
  await redirect.hover();
  await expect(wire("redirect-db")).toHaveCSS("opacity", "1");
  await expect(wire("shorten-db")).toHaveCSS("opacity", "0.13");
  await expect(redirect).toHaveCSS("cursor", "default");
  const paper = await paperPoint(page);
  await page.mouse.move(paper.x, paper.y);
  await expect(wire("redirect-db")).toHaveCSS("opacity", "1");
  await expect(wire("shorten-db")).toHaveCSS("opacity", "1");

  // Detailed: a module's row picks out only that module's wires.
  await showView(page, "Detailed");
  const row = page.locator('.lane-container-row[data-module="redirect-data"]');
  await row.hover();
  await expect(wire("redirect-db/redirect-data")).toHaveCSS("opacity", "1");
  await expect(wire("redirect-cache/redirect-cache-reader")).toHaveCSS("opacity", "0.13");
  await expect(row.locator("button")).toHaveCSS("cursor", "default");
  // The container's header picks out all of its tile's wires.
  await redirect.locator(".lane-container-header").hover();
  await expect(wire("redirect-cache/redirect-cache-reader")).toHaveCSS("opacity", "1");
  await expect(wire("shorten-db/shorten-data")).toHaveCSS("opacity", "0.13");
  expect(await design(page, id)).toEqual(before);
});

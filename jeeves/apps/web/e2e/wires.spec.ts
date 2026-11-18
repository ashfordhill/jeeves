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

test("hover picks out the visible wire and paper restores every wire", async ({
  page,
  tinyurl: id,
}) => {
  const before = await design(page, id);
  await showView(page, "Simple");
  const at = await linePoint(page, "redirect-db");
  await page.mouse.move(at.x, at.y);
  const wire = page.locator('.react-flow__edge[data-id="redirect-db"] .board-wire');
  const other = page.locator('.react-flow__edge[data-id="shorten-db"] .board-wire');
  await expect(wire).toHaveCSS("opacity", "1");
  await expect(other).toHaveCSS("opacity", "0.13");
  const paper = await paperPoint(page);
  await page.mouse.move(paper.x, paper.y);
  await expect(wire).toHaveCSS("opacity", "1");
  await expect(other).toHaveCSS("opacity", "1");
  expect(await design(page, id)).toEqual(before);
});

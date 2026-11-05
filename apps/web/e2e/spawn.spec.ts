import { box, boxes, design, expect, level, lines, ready, test } from "./studio.ts";

test("drags a + handle to create a connected box in one step", async ({ page, tinyurl: id }) => {
  await level(page, "C2");
  const source = box(page, "Shorten API");
  const bounds = await source.boundingBox();
  if (!bounds) throw new Error("Shorten API is not drawn.");
  await page.mouse.move(bounds.x + 24, bounds.y + 12);
  const handle = await source.locator('.studio-spawn[data-side="out"]').first().boundingBox();
  if (!handle) throw new Error("No + handle.");
  await page.mouse.move(handle.x + handle.width / 2, handle.y + handle.height / 2);
  await page.mouse.down();
  await page.mouse.move(handle.x + 170, handle.y - 120, { steps: 12 });
  await page.mouse.up();

  const picker = page.locator(".studio-picker");
  await expect(picker.locator(".studio-kind", { hasText: "Database" })).toBeVisible();
  await picker.locator(".studio-kind", { hasText: "Search index" }).first().click();
  await expect(picker).toHaveCount(0);
  await ready(page);
  await expect(boxes(page)).toHaveCount(13);
  await expect(lines(page)).toHaveCount(12);

  const saved = await design(page, id);
  expect(saved.revision).toBe(2);
  expect(saved.elements.map((e) => e.name)).toContain("Search index");
});

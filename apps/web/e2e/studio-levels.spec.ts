import { boxes, expect, level, lines, test } from "./studio.ts";

test("creates the TinyURL study and shows it at C1, C2 and C3", async ({ page, tinyurl }) => {
  expect(new URL(page.url()).searchParams.get("project")).toBe(tinyurl);
  for (const [name, count, edges] of [
    ["C1", 1, 0],
    ["C2", 8, 8],
    ["C3", 20, 16],
  ] as const) {
    await level(page, name);
    await expect(boxes(page)).toHaveCount(count);
    await expect(lines(page)).toHaveCount(edges);
  }
});

import { boxes, expect, level, lines, test } from "./studio.ts";

test("creates the TinyURL study and shows it at C1, C2 and C3", async ({ page, tinyurl }) => {
  expect(new URL(page.url()).searchParams.get("project")).toBe(tinyurl);
  for (const [name, count, edges] of [
    ["C1", 4, 3],
    ["C2", 12, 11],
    ["C3", 21, 17],
  ] as const) {
    await level(page, name);
    await expect(boxes(page)).toHaveCount(count);
    await expect(lines(page)).toHaveCount(edges);
  }
});

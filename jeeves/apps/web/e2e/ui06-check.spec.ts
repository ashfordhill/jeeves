// UI06 mouse check (temporary): the module menu's groups, dots and legend, the inspector's module
// cards and the module page's words, in light and dark, on YouTube's Watch API and Transcoder.
import { mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  moduleGeneration,
  type StudioComponentKind,
  type StudioKind,
  studioComponentDefinitions,
} from "@jeeves/spec";
import type { Page } from "@playwright/test";
import { moduleGroupOf } from "../src/studio/module-groups.ts";
import { generationWords } from "../src/studio/module-status.ts";
import { addModuleFrom, createStudy, expect, moduleMenu, ready, test, tile } from "./studio.ts";

const evidence = fileURLToPath(
  new URL("../../../../docs/plans/ui-refresh/evidence/ui06/", import.meta.url),
);
mkdirSync(evidence, { recursive: true });

const FAM = {
  light: {
    api: ["#46a0e6", "#d7eafb"],
    data: ["#f4ba36", "#fbeecb"],
    messaging: ["#ea6c9f", "#fbdde9"],
    worker: ["#f28f3d", "#fde4cf"],
    generic: ["#37b8aa", "#d0efea"],
  },
  dark: {
    api: ["#6bb6f2", "#1d4d73"],
    data: ["#f2c65e", "#5c4812"],
    messaging: ["#f08db5", "#642d49"],
    worker: ["#f5a05e", "#6a3b17"],
    generic: ["#5fd0c2", "#185b54"],
  },
} as const;
const BADGE = { light: ["#ffffff", "#cfe0e8"], dark: ["#0f1d26", "#2a4554"] } as const;
const rgb = (hex: string) =>
  `rgb(${[1, 3, 5].map((at) => Number.parseInt(hex.slice(at, at + 2), 16)).join(", ")})`;
const kindNamed = (name: string) =>
  (Object.keys(studioComponentDefinitions) as StudioComponentKind[]).find(
    (kind) => studioComponentDefinitions[kind].name === name,
  ) as StudioComponentKind;
const GROUPS = ["Requests", "Data", "Events", "Files & media", "Custom"];
const SERVICE = [
  ["Rate limiter", "Redirect responder", "Auth guard", "External call"],
  ["Cache reader", "ID generator", "Data access", "Search query", "Favorites"],
  ["Event publisher", "Event consumer"],
  ["Multipart uploads"],
  ["Custom"],
];
const WORKER = [
  ["Rate limiter", "Redirect responder", "Auth guard", "External call"],
  [
    "Cache reader",
    "ID generator",
    "Data access",
    "Lifecycle writer",
    "Event counter",
    "Index writer",
  ],
  ["Event publisher", "Event consumer"],
  ["Video encoder", "Video packager", "Video thumbnailer"],
  ["Custom"],
];
const WORD: Record<string, string> = {
  template: "Generated",
  stub: "You write it",
  custom: "You write it",
  refused: "Refused",
};

/** Checks the open menu against `rows` for a tile of kind `host`, in `theme`. */
async function checkMenu(page: Page, host: StudioKind, rows: string[][], theme: "light" | "dark") {
  const menu = moduleMenu(page);
  await expect(menu).toBeVisible();
  await expect(menu).toBeInViewport({ ratio: 1 });
  const seen = await menu.evaluate((node) => {
    const css = (element: Element, name: string) =>
      getComputedStyle(element).getPropertyValue(name).trim().toLowerCase();
    return {
      groups: [...node.querySelectorAll("fieldset")].map((group) => {
        const legend = group.querySelector("legend") as HTMLElement;
        return {
          label: legend.textContent,
          family: (group as HTMLElement).dataset.family,
          marker: getComputedStyle(legend, "::before").backgroundColor,
          items: [...group.querySelectorAll("[role=menuitem]")].map((item) => {
            const dot = item.querySelector(".lane-generation-dot") as HTMLElement;
            const line = item.querySelector(".lane-module-menu-description") as HTMLElement;
            const name = item.querySelector("strong") as HTMLElement;
            return {
              name: item.getAttribute("aria-label"),
              family: (item as HTMLElement).dataset.family,
              background: getComputedStyle(item).backgroundColor,
              border: getComputedStyle(item).borderTopColor,
              borderWidth: getComputedStyle(item).borderTopWidth,
              nameSize: getComputedStyle(name).fontSize,
              nameWeight: getComputedStyle(name).fontWeight,
              generation: dot.dataset.generation,
              word: dot.title,
              dot: {
                size: dot.getBoundingClientRect().width,
                fill: getComputedStyle(dot).backgroundColor,
                image: getComputedStyle(dot).backgroundImage,
                ring: getComputedStyle(dot).borderTopColor,
              },
              described: document.getElementById(item.getAttribute("aria-describedby") ?? "")
                ?.textContent,
              icons: item.querySelectorAll("svg.studio-icon").length,
              iconSize: item.querySelector("svg.studio-icon")?.getAttribute("width"),
              lineHeight: line.getBoundingClientRect().height,
              fam: css(item, "--fam"),
              sfam: css(item, "--sfam"),
            };
          }),
        };
      }),
      legend: [...node.querySelectorAll(".lane-module-menu-legend li")].map((item) => [
        item.querySelector(".lane-generation-dot")?.getAttribute("data-generation"),
        item.textContent,
      ]),
      legendLine: getComputedStyle(node.querySelector(".lane-module-menu-legend") as Element)
        .borderTopColor,
      tokens: {
        plus: css(document.documentElement, "--plus"),
        inkSoft: css(document.documentElement, "--ink-soft"),
        badge: css(document.documentElement, "--badge"),
        hairline: css(document.documentElement, "--hairline"),
      },
      rect: node.getBoundingClientRect().toJSON(),
      scroll: [node.scrollHeight, node.clientHeight],
    };
  });
  expect(seen.groups.map((group) => group.label)).toEqual(
    GROUPS.filter((_, index) => rows[index]?.length),
  );
  expect(seen.tokens.badge).toBe(BADGE[theme][0]);
  expect(seen.tokens.hairline).toBe(BADGE[theme][1]);
  expect(seen.legendLine).toBe(rgb(BADGE[theme][1]));
  for (const [index, group] of seen.groups.entries()) {
    const family = moduleGroupOf(kindNamed(rows[index]?.[0] as string))
      .family as keyof typeof FAM.light;
    const [fam, sfam] = FAM[theme][family];
    expect(group.family).toBe(family);
    expect(group.marker).toBe(rgb(fam));
    expect(group.items.map((item) => item.name)).toEqual(rows[index]);
    for (const item of group.items) {
      const kind = kindNamed(item.name as string);
      const generation = moduleGeneration(kind, host);
      expect(item.family, item.name as string).toBe(family);
      expect([item.fam, item.sfam]).toEqual([fam, sfam]);
      expect(item.background).toBe(rgb(sfam));
      expect(item.border).toBe(rgb(fam));
      // Chrome draws 1.5px as 1px at a device pixel ratio of 1.
      expect(["1px", "1.5px"]).toContain(item.borderWidth);
      expect([item.nameSize, item.nameWeight]).toEqual(["15px", "900"]);
      expect(item.generation).toBe(generation);
      expect(item.word).toBe(generationWords[generation].word);
      expect(item.described).toBe(
        `${generationWords[generation].word}. ${studioComponentDefinitions[kind].description}`,
      );
      expect([item.icons, item.iconSize]).toEqual([1, "15"]);
      expect(item.lineHeight).toBeLessThan(20);
      expect(item.dot.size).toBe(13);
      if (generation === "lead") expect(item.dot.fill).toBe(rgb(seen.tokens.plus));
      if (generation === "part") expect(item.dot.image).toContain("linear-gradient");
      if (generation === "stub") {
        expect(item.dot.fill).toBe(rgb(seen.tokens.badge));
        expect(item.dot.ring).toBe(rgb(seen.tokens.inkSoft));
      } else expect(item.dot.ring).toBe(rgb(seen.tokens.plus));
    }
  }
  expect(seen.legend).toEqual(
    (["lead", "part", "stub"] as const).map((generation) => [
      generation,
      `${generationWords[generation].word}. ${generationWords[generation].meaning}`,
    ]),
  );
  return seen;
}

/** Checks the inspector's module cards of tile `name`, of kind `host`. */
async function checkCards(page: Page, host: StudioKind, theme: "light" | "dark") {
  const inspector = page.locator(".studio-inspector");
  const cards = await inspector
    .getByRole("list", { name: "Modules", exact: true })
    .locator(".lane-module-card")
    .evaluateAll((nodes) =>
      nodes.map((node) => {
        const pill = node.querySelector(".lane-generation-pill") as HTMLElement;
        const text = node.querySelector(".lane-module-text") as HTMLElement;
        return {
          kind: node.querySelector(".lane-module-kind")?.textContent,
          family: (node as HTMLElement).dataset.family,
          background: getComputedStyle(node).backgroundColor,
          pill: pill.textContent,
          pillFill: getComputedStyle(pill).backgroundColor,
          generation: pill.dataset.generation,
          oneLine: text.getBoundingClientRect().height < 20,
          name: node.querySelector("strong")?.textContent,
        };
      }),
    );
  expect(cards.length).toBeGreaterThan(0);
  for (const card of cards) {
    const kind = kindNamed(card.kind as string);
    const generation = moduleGeneration(kind, host);
    const family = moduleGroupOf(kind).family as keyof typeof FAM.light;
    expect(card.family, card.name as string).toBe(family);
    expect(card.background).toBe(rgb(FAM[theme][family][1]));
    expect(card.pill).toBe(generationWords[generation].word);
    expect(card.generation).toBe(generation);
    expect(card.pillFill).toBe(rgb(BADGE[theme][0]));
    expect(card.oneLine).toBe(true);
  }
  return cards;
}

for (const size of [
  { width: 1440, height: 900 },
  { width: 1280, height: 800 },
]) {
  test.describe(`UI06 at ${size.width}×${size.height}`, () => {
    test.use({ viewport: size });

    test("module menu, cards and words in light and dark", async ({ page }) => {
      test.slow();
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(String(error)));
      const id = await createStudy(
        page,
        `E2E UI06 check ${size.width}`,
        "YouTube · studio study",
        "Simple",
      );
      const shot = (name: string) => `${evidence}${name}`;
      try {
        await page.getByRole("button", { name: "Collapse chat", exact: true }).click();
        const inspector = page.locator(".studio-inspector");
        const rail = page.getByRole("complementary", { name: "Inspector rail" });
        for (const theme of ["light", "dark"] as const) {
          if (theme === "dark") {
            await page.getByRole("button", { name: "Dark mode" }).click();
            await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
          }
          // Watch API's menu, from its `+` on the board.
          await tile(page, "Watch API").click();
          await tile(page, "Watch API").locator(".lane-tile-add").click();
          const service = await checkMenu(page, "service", SERVICE, theme);
          console.log(`${size.width} ${theme} service menu`, service.rect, service.scroll);
          if (size.width === 1440)
            await moduleMenu(page).screenshot({ path: shot(`menu-watch-api-${theme}.png`) });
          await page.keyboard.press("Escape");
          await expect(moduleMenu(page)).toHaveCount(0);

          // The Transcoder's (a Worker), from the inspector's `+`.
          await tile(page, "Transcoder").click();
          await inspector.getByRole("button", { name: "Add module", exact: true }).click();
          const worker = await checkMenu(page, "worker", WORKER, theme);
          console.log(`${size.width} ${theme} worker menu`, worker.rect, worker.scroll);
          if (size.width === 1280)
            await moduleMenu(page).screenshot({ path: shot(`menu-transcoder-${theme}.png`) });
          await page.keyboard.press("Escape");
          await expect(moduleMenu(page)).toHaveCount(0);
          await checkCards(page, "worker", theme);

          // Watch API's cards in the inspector.
          await tile(page, "Watch API").click();
          await checkCards(page, "service", theme);
          if (size.width === 1440)
            await rail.screenshot({ path: shot(`cards-watch-api-${theme}.png`) });
        }

        // A module from each group, on Watch API and on the Transcoder: each opens its page, whose
        // status reads the new words. Watch API refuses Multipart uploads (its two Data access
        // modules on databases), so the Search API service takes it.
        for (const [host, kinds] of [
          ["Watch API", ["External call", "ID generator", "Event consumer", "Custom"]],
          ["Search API", ["Multipart uploads"]],
          [
            "Transcoder",
            ["Rate limiter", "ID generator", "Event publisher", "Video packager", "Custom"],
          ],
        ] as const) {
          for (const kind of kinds) {
            await tile(page, host).click();
            await addModuleFrom(page, tile(page, host), kind);
            const name = inspector.getByLabel("Name", { exact: true });
            await expect(name).toHaveValue(new RegExp(`^${kind}`));
            await expect(name).toBeFocused();
            const status = inspector.locator(".lane-module-status");
            const kindStatus = (await status.getAttribute("data-status")) as string;
            await expect(status.locator("strong")).toHaveText(WORD[kindStatus] as string);
            await ready(page);
          }
          await tile(page, host).click();
          const cards = await checkCards(
            page,
            host === "Transcoder" ? "worker" : "service",
            "dark",
          );
          for (const kind of kinds) expect(cards.map((card) => card.kind)).toContain(kind);
        }
        // Every module page in the new words; Generate project keeps the generator's.
        await tile(page, "Watch API").click();
        const words = new Set<string>();
        const opened = await inspector
          .getByRole("list", { name: "Modules", exact: true })
          .getByRole("button")
          .count();
        for (let index = 0; index < opened; index += 1) {
          await inspector
            .getByRole("list", { name: "Modules", exact: true })
            .getByRole("button")
            .nth(index)
            .click();
          const status = inspector.locator(".lane-module-status");
          const kindStatus = (await status.getAttribute("data-status")) as string;
          const word = (await status.locator("strong").textContent()) as string;
          expect(word).toBe(WORD[kindStatus]);
          words.add(word);
          await inspector.getByRole("button", { name: "Back to Watch API" }).click();
        }
        console.log(`${size.width} Watch API module page words`, [...words]);
        await page
          .getByRole("banner")
          .getByRole("button", { name: "Generate project", exact: true })
          .click();
        const dialog = page.getByRole("dialog", { name: "Generate experimental project" });
        const listed = await dialog
          .getByRole("list", { name: "Generated modules", exact: true })
          .locator(".lane-module-status strong")
          .allTextContents();
        expect(listed.length).toBeGreaterThan(0);
        for (const word of listed)
          expect(["Template", "Stub", "Custom", "Refused"]).toContain(word);
        console.log(`${size.width} Generate dialog words`, [...new Set(listed)]);
        await page.keyboard.press("Escape");
      } finally {
        await page.request.delete(`/api/projects/${id}`);
      }
      expect(errors).toEqual([]);
    });
  });
}

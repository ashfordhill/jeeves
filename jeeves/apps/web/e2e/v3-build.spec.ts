/**
 * V3-11's acceptance: YouTube v3 (contract section 5) designed from a blank project by mouse only
 * (the user's actions, every tile from a link fan, every link in Connect mode, every module from a
 * `+` in its tile or the inspector, every module connection from a row's dot, the useful values
 * and Runnable processes), compared with V3-10's reference by name, scored, counted in Simple and
 * previewed through Generate project. Set JEEVES_V3_BUILD_KEEP to a project name to keep it.
 */
import { writeFile } from "node:fs/promises";
import { designSchema, type GenerationInstalledSupport } from "@jeeves/spec";
import {
  V3_MODULES,
  V3_TEMPLATES,
  V3_VALUES,
  v3Diff,
  v3DiffReport,
  v3ModuleDesign,
} from "../../../packages/spec/src/fixtures/v3-modules.ts";
import { scoreBuild } from "../../server/src/eval/design-score.ts";
import { dashedLines, design, expect, lines, ready, test, tile, tiles } from "./studio.ts";
import { createBlank, gestures, inspector, tool } from "./v2-rebuild.ts";
import { buildV3 } from "./v3-build.ts";

const keep = process.env.JEEVES_V3_BUILD_KEEP;
const STUBS = ["View count reader", "View publisher"];

type Generation = { processes?: true; selections: { id: string; template: { id: string } }[] };

test("designs YouTube v3 from a blank project by mouse", async ({ page }, testInfo) => {
  test.setTimeout(900_000);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(String(error)));
  const log = gestures();
  const started = Date.now();
  const id = await createBlank(page, keep ?? "E2E YouTube v3 build", log);
  try {
    await buildV3(page, id, log);

    // Runnable processes, by its checkbox in Generate project: one more revision.
    await page
      .getByRole("banner")
      .getByRole("button", { name: "Generate project", exact: true })
      .click();
    log.clicks += 1;
    const dialog = page.getByRole("dialog", { name: "Generate experimental project" });
    const box = dialog.getByRole("checkbox", { name: "Runnable processes" });
    await expect(box).not.toBeChecked();
    await box.click();
    log.clicks += 1;
    await expect(box).toBeChecked();
    await expect
      .poll(async () => ((await design(page, id)) as { generation?: Generation }).generation)
      .toMatchObject({ processes: true });
    const built = Date.now() - started;

    // The modules list: 26, 24 of them Template and the two stubs.
    const listed = dialog
      .getByRole("list", { name: "Generated modules", exact: true })
      .getByRole("listitem");
    await expect(listed).toHaveCount(26);
    await expect(listed.filter({ has: page.locator('[data-status="template"]') })).toHaveCount(24);
    for (const name of STUBS)
      await expect(
        listed.filter({ hasText: `${name} in Watch API` }).locator(".lane-module-status"),
      ).toHaveAttribute("data-status", "stub");

    // Preview, by mouse: the 11 templates and 2 stubs, no finding, runnable.
    const response = page.waitForResponse((item) =>
      item.url().endsWith("/experimental-generation/preview"),
    );
    await dialog.getByRole("button", { name: "Preview scaffold", exact: true }).click();
    log.clicks += 1;
    const result = await response;
    expect(result.status()).toBe(200);
    const preview = await result.json();
    expect(preview.report.findings).toEqual([]);
    expect(preview.report.processes.runnable).toBe(true);
    await expect(dialog.getByText(/^Ready: \d+ files/)).toBeVisible();
    await expect(dialog.getByText(/^Processes · \d+ · runnable$/)).toBeVisible();

    const saved = designSchema.parse(await design(page, id));
    const tileName = new Map(saved.elements.map((item) => [item.id, item.name]));
    const components = saved.architecture?.studio?.components ?? [];
    const component = new Map(components.map((item) => [item.id, item]));
    const selected = (preview.templates as { ref: { id: string }; selection: string }[]).map(
      ({ ref, selection }) => {
        const lead = component.get(selection);
        return [
          ref.id,
          tileName.get(lead?.host ?? ""),
          ref.id === "module-stub" ? lead?.name : undefined,
        ];
      },
    );
    const byText = (a: unknown[], b: unknown[]) =>
      JSON.stringify(a).localeCompare(JSON.stringify(b));
    expect(selected.sort(byText)).toEqual(
      V3_TEMPLATES.map((item) => [item.template, item.tile, item.module]).sort(byText),
    );
    expect(
      (preview.modules as { name: string; status: string }[])
        .filter((item) => item.status !== "template")
        .map((item) => [item.name, item.status]),
    ).toEqual(STUBS.map((name) => [name, "stub"]));
    await dialog.getByRole("button", { name: "Close generate experimental project" }).click();
    log.clicks += 1;

    // Every module has the contract's name and description, on its tile.
    expect(
      components.map((item) => [tileName.get(item.host), item.name, item.description]),
    ).toEqual(
      Object.entries(V3_MODULES).flatMap(([host, modules]) =>
        modules.map((item) => [host, item.name, item.description]),
      ),
    );
    // Sign-in: Optional on Watch API's Viewer check, Required on the other two guards.
    const signIn = (name: string) =>
      (components.find((item) => item.name === name)?.settings as { signIn?: string } | undefined)
        ?.signIn;
    expect(["Viewer check", "Account check", "Creator check"].map(signIn)).toEqual([
      "optional",
      "required",
      "required",
    ]);

    // The structural diff against V3-10's reference, and the eval's build score.
    const support = await page.request.get("/api/generation-support");
    const installed = (await support.json()) as GenerationInstalledSupport;
    const rows = v3Diff(saved, installed);
    const report = v3DiffReport(rows);
    expect(report.unexpected).toEqual([]);
    expect(report.unused).toEqual([]);
    const score = scoreBuild(v3ModuleDesign(installed), saved, installed, V3_VALUES);
    expect(score.total).toBe(100);

    // Simple: 21 tiles (with the user and its two actions, 24) and 33 lines, 8 of them dashed.
    expect(saved.elements).toHaveLength(21);
    await expect(
      page.getByRole("group", { name: "View", exact: true }).getByRole("button", {
        name: "Simple",
        exact: true,
      }),
    ).toHaveAttribute("aria-pressed", "true");
    await ready(page);
    await expect(tiles(page)).toHaveCount(24);
    await expect(lines(page)).toHaveCount(33);
    await expect(dashedLines(page)).toHaveCount(8);

    // Detailed draws both in-process slots as gutter arrows.
    await tool(page, "Detailed").click();
    await ready(page);
    for (const [host, from, to] of [
      ["Watch API", "Video details cache", "Video details reader"],
      ["Account API", "Favorite videos", "Video reader"],
    ] as const)
      await expect(
        tile(page, host).locator(".lane-container-loader").getByRole("img"),
      ).toHaveAttribute("aria-label", `${from} to ${to}`);
    await tool(page, "Simple").click();
    await ready(page);
    await expect(inspector(page)).toBeVisible();

    // The evidence: gestures, time, the diff, the score and the preview's summary.
    const evidence = testInfo.outputPath("v3-build.json");
    await writeFile(
      evidence,
      JSON.stringify(
        {
          project: id,
          revision: saved.revision,
          gestures: { ...log, total: log.clicks + log.drags + log.typed },
          builtMs: built,
          diff: {
            rows: rows.length,
            unexpected: report.unexpected,
            intended: report.intended.map(({ rule, rows }) => ({
              area: rule.area,
              key: String(rule.key),
              reason: rule.reason,
              rows,
            })),
          },
          score: {
            total: score.total,
            areas: Object.fromEntries(
              Object.entries(score.areas).map(([area, item]) => [area, item.score]),
            ),
          },
          simple: { tiles: 21, nodes: 24, lines: 33, dashed: 8 },
          preview: {
            files: preview.archive.files,
            status: preview.status,
            templates: selected,
            modules: preview.modules,
            processes: preview.report.processes,
            findings: preview.report.findings,
          },
        },
        null,
        2,
      ),
    );
    await testInfo.attach("v3-build.json", { path: evidence, contentType: "application/json" });
  } finally {
    if (!keep) await page.request.delete(`/api/projects/${id}`);
  }
  expect(errors).toEqual([]);
});

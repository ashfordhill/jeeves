/**
 * MA09's acceptance: YouTube v2 rebuilt from a blank project by mouse only (the user's actions,
 * every tile from a link fan, every link in Connect mode, every module from its tile's `+`, every
 * module connection from a row's dot, and the useful values), compared with the frozen v2 by name,
 * and previewed through Generate project. Set JEEVES_V2_REBUILD_KEEP to a project name to keep it.
 */
import { writeFile } from "node:fs/promises";
import {
  designGeneration,
  designSchema,
  type GenerationInstalledSupport,
  generationTemplates,
} from "@jeeves/spec";
import { v2Diff, v2DiffReport } from "../../../packages/spec/src/fixtures/v2-diff.ts";
import { frozenV2Design } from "../../../packages/spec/src/fixtures/v2-modules.ts";
import { design, expect, ready, test, tile } from "./studio.ts";
import {
  buildV2Modules,
  buildV2Tiles,
  createBlank,
  gestures,
  row,
  tool,
  V2_MODULES,
} from "./v2-rebuild.ts";

const keep = process.env.JEEVES_V2_REBUILD_KEEP;
const STUBS = ["View count reader", "View publisher"];

test("rebuilds YouTube v2 from a blank project by mouse", async ({ page }, testInfo) => {
  test.setTimeout(900_000);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(String(error)));
  const log = gestures();
  const started = Date.now();
  const id = await createBlank(page, keep ?? "E2E YouTube v2 rebuild", log);
  try {
    await buildV2Tiles(page, id, log);
    await buildV2Modules(page, id, log);
    const built = Date.now() - started;

    // The Detailed view draws the loader as the Watch API's gutter arrow.
    await tool(page, "Detailed").click();
    await ready(page);
    const arrow = tile(page, "Watch API").locator(".lane-container-loader");
    await expect(arrow.getByRole("img")).toHaveAttribute(
      "aria-label",
      "Video details cache to Video details reader",
    );
    await expect(row(page, "Transcoder", "Packager")).toBeVisible();
    await tool(page, "Simple").click();
    await ready(page);

    // Every module has the plan's name and description, on its tile.
    const saved = designSchema.parse(await design(page, id));
    const names = (saved.elements ?? []).map((item) => [item.id, item.name] as const);
    const tileName = new Map(names);
    expect(
      (saved.architecture?.studio?.components ?? []).map((item) => [
        tileName.get(item.host),
        item.name,
        item.description,
      ]),
    ).toEqual(
      Object.entries(V2_MODULES).flatMap(([host, modules]) =>
        modules.map((item) => [host, item.name, item.description]),
      ),
    );

    // The structural diff: only the contract's intended differences.
    const support = await page.request.get("/api/generation-support");
    const installed = (await support.json()) as GenerationInstalledSupport;
    const rows = v2Diff(frozenV2Design(), saved, installed);
    const report = v2DiffReport(rows);
    expect(report.unexpected).toEqual([]);
    expect(report.unused).toEqual([]);

    // Generate project → Preview, by mouse: v2's seven installed templates, the Creator check's
    // sign-in (V3-06: the Auth guard leads its own template), the two stubs, and no finding.
    await page
      .getByRole("banner")
      .getByRole("button", { name: "Generate project", exact: true })
      .click();
    const dialog = page.getByRole("dialog", { name: "Generate experimental project" });
    const listed = dialog
      .getByRole("list", { name: "Generated modules", exact: true })
      .getByRole("listitem");
    await expect(listed).toHaveCount(22);
    await expect(listed.filter({ has: page.locator('[data-status="template"]') })).toHaveCount(20);
    for (const name of STUBS)
      await expect(
        listed.filter({ hasText: `${name} in Watch API` }).locator(".lane-module-status"),
      ).toHaveAttribute("data-status", "stub");
    const response = page.waitForResponse((item) =>
      item.url().endsWith("/experimental-generation/preview"),
    );
    await dialog.getByRole("button", { name: "Preview scaffold", exact: true }).click();
    const result = await response;
    expect(result.status()).toBe(200);
    const preview = await result.json();
    expect(preview.report.findings).toEqual([]);
    const templates = (
      preview.templates as { ref: { id: string }; selection: string; host?: string }[]
    ).filter((item) => item.ref.id !== "module-stub");
    const installedV2 = [
      ...(designGeneration(frozenV2Design())?.selections ?? [])
        .filter((item) => !item.binding.kind.startsWith("youtube-"))
        .map((item) => item.template),
      generationTemplates["verified-identity"].ref,
    ].sort((a, b) => a.id.localeCompare(b.id));
    expect(templates.map((item) => item.ref).sort((a, b) => a.id.localeCompare(b.id))).toEqual(
      installedV2,
    );
    expect(templates.find((item) => item.ref.id === "verified-identity")?.selection).toBe(
      (saved.architecture?.studio?.components ?? []).find((item) => item.name === "Creator check")
        ?.id,
    );
    expect(
      (preview.modules as { name: string; status: string }[])
        .filter((item) => item.status !== "template")
        .map((item) => [item.name, item.status]),
    ).toEqual(STUBS.map((name) => [name, "stub"]));
    await expect(dialog.getByText(/^Ready: \d+ files/)).toBeVisible();
    await dialog.getByRole("button", { name: "Close generate experimental project" }).click();

    // The evidence: gestures, time, every diff row by rule, and the preview's summary.
    const evidence = testInfo.outputPath("v2-rebuild.json");
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
          preview: {
            files: preview.archive.files,
            status: preview.status,
            templates: preview.templates,
            modules: preview.modules,
            findings: preview.report.findings,
          },
        },
        null,
        2,
      ),
    );
    await testInfo.attach("v2-rebuild.json", { path: evidence, contentType: "application/json" });
  } finally {
    if (!keep) await page.request.delete(`/api/projects/${id}`);
  }
  expect(errors).toEqual([]);
});

import { mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import AxeBuilder from "@axe-core/playwright";
import { architectureHandoffSchema, architectureProof, type DesignDocument } from "@jeeves/spec";
import type { Page } from "@playwright/test";
import { expect, test } from "./browser-test.ts";
import { editorAction, openNewProject } from "./helpers.ts";

test.use({ actionTimeout: 10_000 });

const dialog = (page: Page) =>
  page.getByRole("dialog", { name: "Implementation handoff", exact: true });
async function open(page: Page) {
  await editorAction(page, "Implementation handoff");
  await expect(dialog(page)).toContainText("exact contract definitions");
}
async function download(page: Page, button: string, path: string) {
  const pending = page.waitForEvent("download");
  await dialog(page).getByRole("button", { name: button, exact: true }).click();
  const file = await pending;
  await file.saveAs(path);
  return readFileSync(path, "utf8");
}
for (const product of ["qrwty", "inventory"] as const) {
  test(`P57 ${product} exports a portable revision-bound brief and the selected SVG by mouse`, async ({
    page,
    request,
  }) => {
    const id = await openNewProject(page, request, `P57 ${product} handoff`);
    const read = async (): Promise<DesignDocument> =>
      (await (await request.get(`/api/projects/${id}/design`)).json()).design;
    const { design, layout } = architectureProof(product);
    try {
      expect(
        (
          await request.post(`/api/projects/${id}/operations`, {
            data: {
              baseRevision: 0,
              ops: [
                ...design.elements.map((element) => ({ op: "addElement", element })),
                ...design.connections.map((connection) => ({ op: "connect", connection })),
                { op: "setArchitecture", architecture: design.architecture },
              ],
            },
          })
        ).status(),
      ).toBe(200);
      expect((await request.put(`/api/projects/${id}/layout`, { data: layout })).status()).toBe(
        200,
      );
      await page.reload();
      await page.getByLabel("C2 view", { exact: true }).selectOption("focus-management");
      await expect(page.locator(".architecture-graph")).toHaveAttribute("aria-busy", "false");
      await editorAction(page, design.architecture!.scenarios![0]!.name);
      const before = await read();
      await open(page);
      await expect(dialog(page)).toContainText("Blocked");
      await expect(dialog(page)).toContainText("Camera excluded");
      expect(
        (await new AxeBuilder({ page }).include('[role="dialog"]').analyze()).violations,
      ).toEqual([]);
      const directory = join("test-results", `p57-${product}`);
      mkdirSync(directory, { recursive: true });
      const content = await download(
        page,
        "Download JSON",
        join(directory, "architecture-handoff.json"),
      );
      const snapshot = architectureHandoffSchema.parse(JSON.parse(content));
      expect(snapshot.diagram?.view).toBe("focus-management");
      expect(snapshot.diagram?.scenario?.id).toBe(design.architecture!.scenarios![0]!.id);
      expect(snapshot.diagram?.edges.some((edge) => edge.steps?.length)).toBe(true);
      expect(snapshot.diagram?.nodes.map((n) => n.id).sort()).toEqual(
        layout.architecture!["focus-management"]!.members!.sort(),
      );
      expect(snapshot.evidence.generation).toBeNull();
      expect(snapshot.contracts.every((c) => c.definition && c.status === "resolved")).toBe(true);
      const markdown = await download(
        page,
        "Download Markdown",
        join(directory, "architecture-handoff.md"),
      );
      for (const link of markdown.matchAll(/\]\(([^)]+)\)/g))
        expect(["./architecture-handoff.json", "./architecture-diagram.svg"]).toContain(link[1]);
      const svg = await download(page, "Download SVG", join(directory, "architecture-diagram.svg"));
      const preview = await page.context().newPage();
      await preview.setViewportSize({ width: 1440, height: 1000 });
      await preview.setContent(`<style>body{margin:0}svg{width:100%;height:auto}</style>${svg}`);
      await preview.screenshot({ path: `test-results/p57-${product}-c2-svg.png` });
      await preview.close();
      expect(svg).toContain("PLANNED");
      expect(svg).toContain(snapshot.diagram!.edges[0]!.path);
      expect(await download(page, "Download JSON", join(directory, "repeat.json"))).toBe(content);
      expect(await read()).toEqual(before);
      await page.screenshot({
        path: `test-results/p57-${product}-handoff-light.png`,
        animations: "disabled",
      });
      await dialog(page).getByRole("tab", { name: "Scope and approval", exact: true }).click();
      await dialog(page)
        .getByLabel("Implementation review scope", { exact: true })
        .fill("Functional contracts and component implementation");
      await dialog(page).getByLabel("Review a partial scope", { exact: true }).check();
      await dialog(page)
        .getByLabel("Excluded scope", { exact: true })
        .fill("Production sizing, SLO, recovery and commercial acceptance");
      for (const item of snapshot.openItems.filter(
        (i) =>
          i.kind === "decision" ||
          i.kind === "objective" ||
          (i.kind === "finding" && /OBJECTIVE/.test(i.message)),
      )) {
        await dialog(page)
          .getByLabel(`Owner for ${item.id}`, { exact: true })
          .fill("Product owner and operations");
        await dialog(page)
          .getByLabel(`Blocked scope for ${item.id}`, { exact: true })
          .fill("Production approval and capacity sizing");
      }
      await dialog(page).getByRole("button", { name: "Save scope", exact: true }).click();
      await expect(dialog(page)).not.toBeVisible();
      await open(page);
      await expect(dialog(page)).toContainText("Needs review");
      await dialog(page).getByRole("tab", { name: "Scope and approval", exact: true }).click();
      await dialog(page)
        .getByLabel("Explicit review approval", { exact: true })
        .fill("Approve functional scope; production objectives remain excluded and assigned.");
      await dialog(page)
        .getByRole("button", { name: "Approve implementation review scope", exact: true })
        .click();
      await expect(dialog(page)).not.toBeVisible();
      await page.getByRole("button", { name: "Undo", exact: true }).click();
      await expect
        .poll(async () => (await read()).architecture?.implementationHandoff?.review)
        .toBeUndefined();
      await open(page);
      await expect(dialog(page)).toContainText("Needs review");
      await dialog(page).getByRole("button", { name: "Close handoff", exact: true }).click();
      await page.getByRole("button", { name: "Redo", exact: true }).click();
      await expect
        .poll(async () => (await read()).architecture?.implementationHandoff?.review)
        .toBeDefined();
      await page.reload();
      await open(page);
      await expect(dialog(page)).toContainText("Ready for implementation review");
      const approved = architectureHandoffSchema.parse(
        JSON.parse(await download(page, "Download JSON", join(directory, "approved.json"))),
      );
      const reviewedDirectory = join(directory, "reviewed");
      mkdirSync(reviewedDirectory, { recursive: true });
      await download(page, "Download JSON", join(reviewedDirectory, "architecture-handoff.json"));
      await download(page, "Download Markdown", join(reviewedDirectory, "architecture-handoff.md"));
      await download(page, "Download SVG", join(reviewedDirectory, "architecture-diagram.svg"));
      await page.screenshot({
        path: `test-results/p57-${product}-reviewed-light.png`,
        animations: "disabled",
      });
      await dialog(page).getByRole("button", { name: "Close handoff", exact: true }).click();
      // Camera movement changes neither semantic revision nor review approval.
      await page.getByRole("button", { name: "Zoom In", exact: true }).click();
      await open(page);
      await expect(dialog(page)).toContainText("Ready for implementation review");
      const zoomed = architectureHandoffSchema.parse(
        JSON.parse(await download(page, "Download JSON", join(directory, "zoomed.json"))),
      );
      expect(zoomed.designFingerprint).toBe(approved.designFingerprint);
      expect(zoomed.diagram?.layoutFingerprint).toBe(approved.diagram?.layoutFingerprint);
      await dialog(page).getByRole("button", { name: "Close handoff", exact: true }).click();
      const current = await read();
      const architecture = structuredClone(current.architecture!);
      architecture.system.name += " revised";
      expect(
        (
          await request.post(`/api/projects/${id}/operations`, {
            data: {
              baseRevision: current.revision,
              ops: [{ op: "setArchitecture", architecture }],
            },
          })
        ).status(),
      ).toBe(200);
      await page.reload();
      await open(page);
      await expect(dialog(page)).toContainText("Stale");
      await dialog(page).getByRole("tab", { name: "Coverage", exact: true }).click();
      expect(
        (await new AxeBuilder({ page }).include('[role="dialog"]').analyze()).violations,
      ).toEqual([]);
      await dialog(page).getByRole("button", { name: "Close handoff", exact: true }).click();
      await page.getByRole("button", { name: "Dark mode", exact: true }).click();
      await page.setViewportSize({ width: 390, height: 844 });
      await open(page);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      );
      expect(
        (await new AxeBuilder({ page }).include('[role="dialog"]').analyze()).violations,
      ).toEqual([]);
      await page.screenshot({
        path: `test-results/p57-${product}-handoff-dark-narrow.png`,
        animations: "disabled",
      });
      expect((await request.get(`/api/projects/${id}/generation`)).status()).toBe(200);
    } finally {
      if (await dialog(page).count())
        await dialog(page).getByRole("button", { name: "Close handoff", exact: true }).click();
      await page.getByRole("tab", { name: "Runs", exact: true }).click();
      await page.waitForLoadState("networkidle");
      await request.delete(`/api/projects/${id}`);
    }
  });
}

test("P57 exports C1/C3 geometry and refuses an unbound critical interface", async ({
  page,
  request,
}) => {
  const id = await openNewProject(page, request, "P57 critical interface");
  const { design, layout } = architectureProof("inventory");
  const contract = design.architecture!.contracts!.find((c) => c.kind === "api")!;
  design.architecture!.interfaces!.push({
    id: "critical-unbound",
    name: "Critical implementation contract",
    owner: { kind: "component", id: design.architecture!.components![0]!.id },
    direction: "required",
    necessity: "required",
    contract: { id: contract.id, version: contract.version },
  });
  design.architecture!.patternInstances![0]!.version = "99.0.0";
  try {
    expect(
      (
        await request.post(`/api/projects/${id}/operations`, {
          data: {
            baseRevision: 0,
            ops: [
              ...design.elements.map((element) => ({ op: "addElement", element })),
              ...design.connections.map((connection) => ({ op: "connect", connection })),
              { op: "setArchitecture", architecture: design.architecture },
            ],
          },
        })
      ).status(),
    ).toBe(200);
    expect((await request.put(`/api/projects/${id}/layout`, { data: layout })).status()).toBe(200);
    await page.reload();
    for (const level of ["C1 Context", "C3 Components"]) {
      await page.getByRole("button", { name: level, exact: true }).click();
      if (level === "C3 Components")
        await page.getByLabel("Component container", { exact: true }).selectOption("api");
      await expect(page.locator(".architecture-graph")).toHaveAttribute("aria-busy", "false");
      await open(page);
      await expect(dialog(page)).toContainText("UNBOUND_REQUIRED");
      await expect(dialog(page)).toContainText("tenant-workspace-access@99.0.0: unavailable");
      await expect(dialog(page)).toContainText("Camera excluded");
      mkdirSync("test-results/p57-critical", { recursive: true });
      const output = await download(
        page,
        "Download JSON",
        `test-results/p57-critical/${level.slice(0, 2)}.json`,
      );
      const snapshot = architectureHandoffSchema.parse(JSON.parse(output));
      expect(snapshot.openItems.some((i) => i.critical && /UNBOUND_REQUIRED/.test(i.message))).toBe(
        true,
      );
      const svg = await download(
        page,
        "Download SVG",
        `test-results/p57-critical/${level.slice(0, 2)}.svg`,
      );
      expect(
        await page.evaluate(
          (content) =>
            new DOMParser()
              .parseFromString(content, "image/svg+xml")
              .querySelectorAll("parsererror").length,
          svg,
        ),
      ).toBe(0);
      expect(snapshot.diagram?.nodes.length).toBeGreaterThan(1);
      const preview = await page.context().newPage();
      await preview.setViewportSize({ width: 1440, height: 1000 });
      await preview.setContent(`<style>body{margin:0}svg{width:100%;height:auto}</style>${svg}`);
      await preview.screenshot({
        path: `test-results/p57-${level.slice(0, 2).toLowerCase()}-svg.png`,
      });
      await preview.close();
      await dialog(page).getByRole("tab", { name: "Scope and approval", exact: true }).click();
      await expect(
        dialog(page).getByRole("button", {
          name: "Approve implementation review scope",
          exact: true,
        }),
      ).toBeDisabled();
      await dialog(page).getByRole("button", { name: "Close handoff", exact: true }).click();
    }
    await editorAction(page, "Deployment plans");
    const deployment = page.getByRole("dialog", { name: "Deployment plans", exact: true });
    await expect(deployment.locator(".architecture-graph")).toHaveAttribute("aria-busy", "false");
    await deployment
      .getByRole("button", { name: "Export deployment handoff", exact: true })
      .click();
    await expect(dialog(page)).toContainText("Camera excluded");
    const deploymentBrief = architectureHandoffSchema.parse(
      JSON.parse(
        await download(page, "Download JSON", "test-results/p57-critical/deployment.json"),
      ),
    );
    expect(deploymentBrief.diagram?.view).toMatch(/^deployment:/);
    expect(deploymentBrief.intent.deployments?.length).toBeGreaterThan(0);
    const deploymentSvg = await download(
      page,
      "Download SVG",
      "test-results/p57-critical/deployment.svg",
    );
    expect(
      await page.evaluate(
        (content) =>
          new DOMParser().parseFromString(content, "image/svg+xml").querySelectorAll("parsererror")
            .length,
        deploymentSvg,
      ),
    ).toBe(0);
    await dialog(page).getByRole("button", { name: "Close handoff", exact: true }).click();
    await deployment.getByRole("button", { name: "Edit deployment plan", exact: true }).click();
    await expect(
      deployment.getByRole("button", { name: "Export deployment handoff", exact: true }),
    ).toBeDisabled();
    await deployment.getByRole("button", { name: "Cancel changes", exact: true }).click();
    await deployment.getByRole("button", { name: "Done", exact: true }).click();
  } finally {
    if (await dialog(page).count())
      await dialog(page).getByRole("button", { name: "Close handoff", exact: true }).click();
    await page.getByRole("tab", { name: "Runs", exact: true }).click();
    await page.waitForLoadState("networkidle");
    await request.delete(`/api/projects/${id}`);
  }
});

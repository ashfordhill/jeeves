import { designGeneration, designSchema, studioStudySeedOperations } from "@jeeves/spec";
import { workloadDesign } from "../../../../field-projects/generator-system/fixtures/rg-workload/design.ts";
import { createStudy, design, dragOnto, expect, ready, stillBoard, test, tile } from "./studio.ts";

test("workload links fix atomic runnable refusal by mouse without a user Sign-in", async ({
  page,
  tinyurl,
}) => {
  await expect(tile(page, "Redirect service")).toBeVisible();
  const id = await createStudy(page, "E2E RG09 workload", "blank");
  try {
    const source = workloadDesign();
    const studio = source.architecture?.studio;
    if (!studio) throw Error("studio");
    studio.componentConnections = studio.componentConnections?.filter(
      (link) => link.slot !== "workload",
    );
    if (source.schemaVersion !== 3 || !source.generation) throw Error("generation");
    delete source.generation.processes;
    const ops = studioStudySeedOperations(source);
    ops.push({ op: "setGeneration", generation: source.generation });
    const seeded = await page.request.post(`/api/projects/${id}/operations`, {
      data: { baseRevision: 0, source: "api", ops },
    });
    expect(seeded.ok(), await seeded.text()).toBe(true);
    await page.reload();
    await ready(page);
    await page.getByRole("button", { name: "Collapse chat", exact: true }).click();
    const preview = async () => {
      const response = page.waitForResponse((r) =>
        r.url().endsWith("/experimental-generation/preview"),
      );
      await page.getByRole("button", { name: "Preview scaffold", exact: true }).click();
      return (await response).json();
    };
    await page.getByRole("button", { name: "Generate project", exact: true }).click();
    const before = await design(page, id);
    await page.getByRole("checkbox", { name: "Runnable processes", exact: true }).click();
    await expect(
      page.getByRole("checkbox", { name: "Runnable processes", exact: true }),
    ).not.toBeChecked();
    await expect(page.getByRole("alert")).toContainText(
      "Private network does not replace workload identity",
    );
    expect(await design(page, id)).toEqual(before);
    await page.getByRole("button", { name: "Close generate experimental project" }).click();
    await page.getByRole("button", { name: "Connect", exact: true }).click();
    for (const module of ["send", "receive"]) {
      await stillBoard(page);
      const dot = page.locator(
        `.board .lane-container-row[data-module="${module}"] .lane-container-row-dot`,
      );
      await dragOnto(page, dot, tile(page, "Issuer"));
      await page.mouse.up();
      await expect
        .poll(
          async () =>
            (
              (await design(page, id)) as unknown as {
                architecture?: {
                  studio?: { componentConnections?: { from: string; slot?: string }[] };
                };
              }
            ).architecture?.studio?.componentConnections?.filter(
              (link: { from: string; slot?: string }) =>
                link.from === module && link.slot === "workload",
            ).length,
        )
        .toBe(1);
    }
    const blueprint = await (
      await page.request.get(`/api/projects/${id}/blueprint?version=3`)
    ).json();
    expect(
      blueprint.componentLinks.filter((link: { slot?: string }) => link.slot === "workload"),
    ).toHaveLength(2);
    await page.getByRole("button", { name: "Generate project", exact: true }).click();
    await page.getByRole("checkbox", { name: "Runnable processes", exact: true }).click();
    await expect(
      page.getByRole("checkbox", { name: "Runnable processes", exact: true }),
    ).toBeChecked();
    await expect
      .poll(async () => designGeneration(designSchema.parse(await design(page, id)))?.processes)
      .toBe(true);
    const result = await preview();
    expect(result.report.findings).toEqual([]);
    expect(result.report.processes.runnable).toBe(true);
    expect(
      result.report.processes.tiles.find((p: { tile: string }) => p.tile === "callee")
        .workloadCallers,
    ).toEqual(["caller"]);
    expect(tinyurl).not.toBe(id);
  } finally {
    await page.request.delete(`/api/projects/${id}`);
  }
});

test("Auth guard adds workload identity by mouse after its user identity is connected", async ({
  page,
}) => {
  const id = await createStudy(page, "E2E RG09 guard workload", "blank");
  try {
    const source = workloadDesign(true);
    if (source.schemaVersion !== 3 || !source.generation) throw Error("generation");
    const ops = studioStudySeedOperations(source);
    ops.push({ op: "setGeneration", generation: source.generation });
    const seed = await page.request.post(`/api/projects/${id}/operations`, {
      data: { baseRevision: 0, source: "api", ops },
    });
    expect(seed.ok(), await seed.text()).toBe(true);
    await page.reload();
    await ready(page);
    await page.getByRole("button", { name: "Collapse chat", exact: true }).click();
    await page.getByRole("button", { name: "Connect", exact: true }).click();
    await stillBoard(page);
    await dragOnto(
      page,
      page.locator('.board .lane-container-row[data-module="caller-auth"] .lane-container-row-dot'),
      tile(page, "Issuer"),
    );
    await page.mouse.up();
    await expect
      .poll(
        async () =>
          (
            (await design(page, id)) as unknown as {
              architecture?: {
                studio?: { componentConnections?: { from: string; slot?: string }[] };
              };
            }
          ).architecture?.studio?.componentConnections?.filter(
            (link: { from: string }) => link.from === "caller-auth",
          ).length,
      )
      .toBe(2);
    const blueprint = await (
      await page.request.get(`/api/projects/${id}/blueprint?version=3`)
    ).json();
    expect(
      blueprint.componentLinks.filter(
        (link: { from: string; slot?: string }) =>
          link.from === "caller-auth" && link.slot === "workload",
      ),
    ).toHaveLength(1);
    expect(
      blueprint.componentLinks.filter(
        (link: { from: string; slot?: string }) =>
          link.from === "caller-auth" && link.slot === undefined,
      ),
    ).toHaveLength(1);
  } finally {
    await page.request.delete(`/api/projects/${id}`);
  }
});

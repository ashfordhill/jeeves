import { designOwnership, designSchema, studioStudySeedOperations } from "@jeeves/spec";
import { stubStackDesign } from "../../../packages/spec/src/fixtures/stub-stack.ts";
import { design, expect, ready, test, tile } from "./studio.ts";

// The shared harness first loads TinyURL. This project adds mouse-only ownership/access edits.
test("chooses shared logical ownership and precise product permissions by mouse", async ({
  page,
  tinyurl,
}) => {
  await expect(tile(page, "Redirect service")).toBeVisible();
  const response = await page.request.post("/api/projects", {
    data: { name: "E2E RG06 logical ownership" },
  });
  const id = (await response.json()).project.id as string;
  try {
    const source = stubStackDesign();
    const ops = studioStudySeedOperations(source);
    if (source.schemaVersion !== 3 || !source.generation)
      throw new Error("module fixture required");
    ops.push({ op: "setGeneration", generation: source.generation });
    const seeded = await page.request.post(`/api/projects/${id}/operations`, {
      data: { baseRevision: 0, source: "canvas", ops },
    });
    expect(seeded.ok(), await seeded.text()).toBe(true);
    await page.goto(`/?project=${id}`);
    await ready(page);
    const inspector = page.locator(".studio-inspector");
    await tile(page, "Visit worker").getByText("Visit worker", { exact: true }).first().click();
    await inspector.getByLabel("Share logical owner with API").selectOption("links-api");
    await expect
      .poll(
        async () =>
          designOwnership(designSchema.parse(await design(page, id))).roles.find(
            (role) => role.element === "visit-worker",
          )?.sharedWith,
      )
      .toBe("links-api");
    await inspector.getByLabel("Product table", { exact: true }).fill("items");
    await inspector.getByLabel("UPDATE", { exact: true }).check();
    await inspector.getByRole("button", { name: "Save table access" }).click();
    await expect
      .poll(
        async () =>
          designOwnership(designSchema.parse(await design(page, id))).grants.find(
            (grant) => grant.role === "visit-worker" && grant.resource === "links-db",
          )?.product,
      )
      .toEqual({
        tables: [{ name: "items", operations: ["SELECT", "UPDATE"] }],
        views: [],
      });
    const before = await design(page, id);
    await inspector.getByLabel("Share logical owner with API").selectOption("stats-api");
    await expect(page.getByRole("alert")).toContainText("conflicting owners");
    expect(await design(page, id)).toEqual(before);
    await inspector.getByLabel("Published view", { exact: true }).fill("visible_items");
    await inspector.getByRole("button", { name: "Allow named view" }).click();
    await expect
      .poll(
        async () =>
          designOwnership(designSchema.parse(await design(page, id))).grants.find(
            (grant) => grant.role === "visit-worker",
          )?.product?.views,
      )
      .toEqual(["visible_items"]);
    const blueprint = await (
      await page.request.get(`/api/projects/${id}/blueprint?version=3`)
    ).json();
    expect(
      blueprint.ownership.roles.find((role: { element: string }) => role.element === "visit-worker")
        .sharedWith,
    ).toBe("links-api");
    expect(tinyurl).not.toBe(id);
  } finally {
    await page.request.delete(`/api/projects/${id}`);
  }
});

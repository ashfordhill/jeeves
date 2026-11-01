import { readFileSync } from "node:fs";
import AxeBuilder from "@axe-core/playwright";
import { architectureExample, type DesignDocument } from "@jeeves/spec";
import { expect, test } from "./browser-test.ts";
import { editorAction, inspectObject } from "./helpers.ts";

for (const example of ["qr", "qrwty-target", "link-platform", "community", "social"] as const) {
  test(`${example} C2/C3 relationships carry labels and protocols with interaction line styles`, async ({
    page,
    request,
  }) => {
    const fixture: DesignDocument =
      example === "qr"
        ? JSON.parse(
            readFileSync(
              new URL("../../../fixtures/designs/qrwty-architecture.json", import.meta.url),
              "utf8",
            ),
          )
        : architectureExample(example).design;
    const created = await request.post("/api/projects", { data: { name: `P40 ${example}` } });
    const id = (await created.json()).project.id;
    try {
      expect(
        (
          await request.post(`/api/projects/${id}/operations`, {
            data: {
              baseRevision: 0,
              ops: [
                ...fixture.elements.map((element) => ({ op: "addElement", element })),
                ...fixture.connections.map((connection) => ({ op: "connect", connection })),
                { op: "setArchitecture", architecture: fixture.architecture },
              ],
            },
          })
        ).status(),
      ).toBe(200);
      const layout =
        example === "qr"
          ? JSON.parse(
              readFileSync(
                new URL("../../../fixtures/designs/qrwty.layout.json", import.meta.url),
                "utf8",
              ),
            )
          : architectureExample(example).layout;
      await request.put(`/api/projects/${id}/layout`, { data: layout });
      await page.goto(`/?project=${id}#/draw`);
      await expect(page.locator(".connection-chip")).toHaveCount(fixture.connections.length);
      await page.getByRole("button", { name: "Fit View", exact: true }).click();
      await expect
        .poll(() =>
          page.locator(".connection-chip, .context-chip").evaluateAll((labels) => {
            const cards = [...document.querySelectorAll(".element-card, .c2-context-card")].map(
              (card) => card.getBoundingClientRect(),
            );
            const boxes = labels.map((label) => label.getBoundingClientRect());
            const board = document
              .querySelector(".draw-board .react-flow")!
              .getBoundingClientRect();
            if (
              boxes.some(
                (box) =>
                  box.left < board.left ||
                  box.right > board.right ||
                  box.top < board.top ||
                  box.bottom > board.bottom,
              )
            )
              return false;
            const overlaps = (a: DOMRect, b: DOMRect) =>
              a.left < b.right - 1 &&
              a.right > b.left + 1 &&
              a.top < b.bottom - 1 &&
              a.bottom > b.top + 1;
            return boxes.every(
              (box, index) =>
                cards.every((card) => !overlaps(box, card)) &&
                boxes.slice(index + 1).every((other) => !overlaps(box, other)),
            );
          }),
        )
        .toBe(true);
      for (const connection of fixture.connections) {
        const path = page.locator(`.react-flow__edge[data-id="${connection.id}"] .connection-path`);
        await expect(path).toHaveCSS(
          "stroke-dasharray",
          connection.planned?.interaction === "Asynchronous" ? "7px, 4px" : "none",
        );
      }
      for (const chip of await page.locator(".connection-chip").all()) {
        await expect(chip.locator(".relationship-description")).not.toHaveText(
          /^(calls|uses database|depends on|Declared use|Uses store)$/i,
        );
        await expect(chip.locator(".relationship-protocol")).not.toBeEmpty();
        await expect(chip.locator(".relationship-planned")).toHaveCount(example === "qr" ? 0 : 1);
      }
      expect(
        (await new AxeBuilder({ page }).include(".integrated-editor").analyze()).violations,
      ).toEqual([]);
      await page.screenshot({
        path: `test-results/p40-${example}-c2-light.png`,
        animations: "disabled",
      });
      await inspectObject(page, `container:${example === "qr" ? "qrwty" : "api"}`);
      const details = page.getByRole("complementary", { name: "Architecture details" });
      await details.getByRole("button", { name: "Open components", exact: true }).click();
      await expect(
        page.getByRole("region", { name: "components diagram", exact: true }),
      ).toHaveAttribute("aria-busy", "false");
      for (const label of await page.locator(".architecture-relation-label").all()) {
        await expect(label.locator(".relationship-description")).not.toHaveText(
          /^(Declared use|Uses store|calls|uses database)$/i,
        );
        await expect(label.locator(".relationship-protocol")).not.toBeEmpty();
      }
      expect(
        await page.locator(".architecture-relation-label").evaluateAll((labels) =>
          labels.every((label) => {
            const parts = [...label.children].map((child) => child.getBoundingClientRect());
            return parts.slice(1).every((part, index) => part.top >= parts[index]!.bottom - 1);
          }),
        ),
      ).toBe(true);
      if (await details.isVisible()) await editorAction(page, "Hide inspector");
      await page.getByRole("button", { name: "Fit View", exact: true }).click();
      await page.screenshot({
        path: `test-results/p40-${example}-c3-light.png`,
        animations: "disabled",
      });
      expect(
        (await new AxeBuilder({ page }).include(".integrated-editor").analyze()).violations,
      ).toEqual([]);
      await page.getByRole("button", { name: "C2 Containers", exact: true }).click();
      if (await details.isVisible()) await editorAction(page, "Hide inspector");
      await page.setViewportSize({ width: 390, height: 844 });
      await page.getByRole("button", { name: "Dark mode", exact: true }).click();
      await page.getByRole("button", { name: "Fit View", exact: true }).click();
      expect(
        (await new AxeBuilder({ page }).include(".integrated-editor").analyze()).violations,
      ).toEqual([]);
      await page.screenshot({
        path: `test-results/p40-${example}-c2-dark.png`,
        animations: "disabled",
      });
    } finally {
      await request.delete(`/api/projects/${id}`);
    }
  });
}

test("executable presentation edits save, cancel, undo, redo and reload; a 409 retains the draft", async ({
  page,
  request,
  browserProblems,
}) => {
  const created = await request.post("/api/projects/from-recipe", {
    data: { name: "P40 relationship editing", recipe: { id: "qr-studio", version: "0.1.0" } },
  });
  const id = (await created.json()).project.id;
  const read = async () =>
    (await (await request.get(`/api/projects/${id}/design`)).json()).design as DesignDocument;
  try {
    await page.goto(`/?project=${id}#/draw`);
    const before = await read();
    const connection = before.connections.find((item) => item.kind === "uses-database")!;
    await inspectObject(page, `connection:${connection.id}`);
    const details = page.getByRole("complementary", { name: "Architecture details" });
    const label = details.getByLabel("Relationship label", { exact: true });
    const protocol = details.getByLabel("Protocol", { exact: true });
    await label.fill("Discard this draft");
    await details.getByRole("button", { name: "Cancel", exact: true }).click();
    await expect(label).toHaveValue("");
    await label.fill("Persists links and artwork");
    await protocol.fill("PostgreSQL/SQL");
    await details.getByRole("button", { name: "Save relationship", exact: true }).click();
    await expect
      .poll(async () => (await read()).connections.find((item) => item.id === connection.id)?.label)
      .toBe("Persists links and artwork");
    await page.getByRole("button", { name: "Undo", exact: true }).click();
    await expect(label).toHaveValue("");
    await page.getByRole("button", { name: "Redo", exact: true }).click();
    await expect(label).toHaveValue("Persists links and artwork");
    await page.reload();
    await inspectObject(page, `connection:${connection.id}`);
    await expect(protocol).toHaveValue("PostgreSQL/SQL");
    expect((await read()).connections.map((item) => item.id)).toEqual(
      before.connections.map((item) => item.id),
    );
    await label.fill("Retained relationship draft");
    const current = await read();
    await request.post(`/api/projects/${id}/operations`, {
      data: {
        baseRevision: current.revision,
        ops: [{ op: "updateConnection", id: connection.id, label: "Edited elsewhere" }],
      },
    });
    const conflict = browserProblems.expectHttp({
      scenario: "P40 relationship conflict",
      resourceType: "fetch",
      method: "POST",
      url: new URL(`/api/projects/${id}/operations`, page.url()).href,
      status: 409,
    });
    await details.getByRole("button", { name: "Save relationship", exact: true }).click();
    await expect(details.getByRole("alert")).toContainText(/changed|reloaded|revision/i);
    await expect(label).toHaveValue("Retained relationship draft");
    conflict.finish();
    await inspectObject(page, "container:qrwty-web");
    await inspectObject(page, `connection:${connection.id}`);
    await expect(label).toHaveValue("Retained relationship draft");
    await page.screenshot({ path: "test-results/p40-conflict.png", animations: "disabled" });
    await details.getByRole("button", { name: "Cancel", exact: true }).click();
    await expect(label).toHaveValue("Edited elsewhere");
  } finally {
    await request.delete(`/api/projects/${id}`);
  }
});

test("planned interaction style edits persist through undo and reload", async ({
  page,
  request,
}) => {
  const fixture = architectureExample("link-platform");
  const created = await request.post("/api/projects", { data: { name: "P40 streaming" } });
  const id = (await created.json()).project.id;
  try {
    await request.post(`/api/projects/${id}/operations`, {
      data: {
        baseRevision: 0,
        ops: [
          ...fixture.design.elements.map((element) => ({ op: "addElement", element })),
          ...fixture.design.connections.map((connection) => ({ op: "connect", connection })),
          { op: "setArchitecture", architecture: fixture.design.architecture },
        ],
      },
    });
    await request.put(`/api/projects/${id}/layout`, { data: fixture.layout });
    await page.goto(`/?project=${id}#/draw`);
    await inspectObject(page, "connection:api-queue");
    const details = page.getByRole("complementary", { name: "Architecture details" });
    await details.getByLabel("Protocol", { exact: true }).fill("AMQP");
    await details.getByLabel("Interaction", { exact: true }).selectOption("Streaming");
    await details.getByRole("button", { name: "Save relationship", exact: true }).click();
    const path = page.locator('.react-flow__edge[data-id="api-queue"] .connection-path');
    await expect(path).toHaveCSS("stroke-dasharray", "2px, 3px");
    await page.getByRole("button", { name: "Undo", exact: true }).click();
    await expect(path).toHaveCSS("stroke-dasharray", "7px, 4px");
    await page.getByRole("button", { name: "Redo", exact: true }).click();
    await expect(path).toHaveCSS("stroke-dasharray", "2px, 3px");
    await page.reload();
    await inspectObject(page, "connection:api-queue");
    await expect(details.getByLabel("Protocol", { exact: true })).toHaveValue("AMQP");
    await expect(details.getByLabel("Interaction", { exact: true })).toHaveValue("Streaming");
    await page.screenshot({ path: "test-results/p40-streaming.png", animations: "disabled" });
  } finally {
    await request.delete(`/api/projects/${id}`);
  }
});

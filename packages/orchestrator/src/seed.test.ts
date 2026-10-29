import type { DesignDocument } from "@jeeves/spec";
import { describe, expect, it } from "vitest";
import { elementOrder, orderProblems, type PlannedTask, seedPlan } from "./seed.ts";
import { fixtureDesign, lockOf, templates } from "./test-support.ts";

const design = fixtureDesign();
const seed = (d: DesignDocument) =>
  seedPlan({ design: d, lock: lockOf(d), templates: templates.lookup });

describe("seedPlan", () => {
  it("makes one task per element and attachment with notes, in dependency order", () => {
    const tasks = seed(design);
    expect(tasks.map((t) => t.key)).toEqual(["links.links-api", "links", "web"]);
    expect(tasks[0]).toMatchObject({
      element: "links",
      attachment: "links-api",
      title: "Implement REST API server (links-api) on Links service",
      description: expect.stringContaining("POST /links"),
      acceptance: [],
      ownedPaths: ["contracts/links.openapi.yaml", "services/links/"],
      dependsOn: ["links-db"],
      source: "seed",
    });
    expect(tasks[2]).toMatchObject({
      key: "web",
      attachment: null,
      title: "Implement Web app",
      ownedPaths: ["frontends/web/"],
      dependsOn: ["links"],
    });
  });

  it("orders databases, then servers, then their clients, then frontends", () => {
    // Reverse the document order so only dependencies and kinds decide.
    const reversed = { ...design, elements: [...design.elements].reverse() };
    expect(elementOrder(reversed, templates.lookup)).toEqual(["links-db", "links", "web"]);
    const withNotes = structuredClone(reversed);
    for (const element of withNotes.elements) element.notes ||= `Notes for ${element.id}`;
    expect(seed(withNotes).map((t) => t.key)).toEqual([
      "links-db",
      "links.links-api",
      "links",
      "web",
    ]);
  });

  it("puts a service before the services that call it, and survives call cycles", () => {
    const d = structuredClone(design);
    const links = d.elements.find((e) => e.id === "links");
    if (!links) throw new Error("fixture changed");
    const stats = {
      ...structuredClone(links),
      id: "stats",
      name: "Stats",
      notes: "Count",
      attachments: [],
    };
    d.elements.unshift(stats);
    d.connections.push({
      id: "stats-calls-links",
      kind: "depends-on",
      from: { element: "stats" },
      to: { element: "links" },
    });
    expect(elementOrder(d, templates.lookup)).toEqual(["links-db", "links", "stats", "web"]);

    d.connections.push({
      id: "links-calls-stats",
      kind: "depends-on",
      from: { element: "links" },
      to: { element: "stats" },
    });
    // A cycle: the earlier element in the document goes first, after the database.
    expect(elementOrder(d, templates.lookup)).toEqual(["links-db", "stats", "links", "web"]);
  });

  it("plans nothing when no element has notes", () => {
    const d = structuredClone(design);
    for (const element of d.elements) {
      element.notes = "  ";
      for (const attachment of element.attachments) attachment.notes = "";
    }
    expect(seed(d)).toEqual([]);
  });
});

describe("orderProblems", () => {
  it("reports a task moved ahead of a task it depends on", () => {
    const tasks = seed(design);
    expect(orderProblems(tasks)).toEqual([]);
    const [api, links, web] = tasks as [PlannedTask, PlannedTask, PlannedTask];
    expect(orderProblems([web, api, links])).toEqual([
      {
        key: "web",
        message:
          '"Implement Web app" comes before "Implement REST API server (links-api) on Links service", but web depends on links.',
      },
    ]);
  });
});

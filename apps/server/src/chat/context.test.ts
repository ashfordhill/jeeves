import { architectureExample, emptyDesign, plannedCapabilities } from "@jeeves/spec";
import { expect, it } from "vitest";
import { designSummary, INSTRUCTIONS, turnContext } from "./context.ts";

it("includes every planned family and complete architecture in the per-turn context", () => {
  const design = architectureExample("qrwty-target").design;
  const context = turnContext(design, [], ["api"]);
  for (const entry of plannedCapabilities) {
    expect(context).toContain(`${entry.id} (${entry.scope}, ${entry.role})`);
  }
  expect(context).toContain("Read options with describePlannedCapability");
  expect(context).toContain(JSON.stringify(design.architecture));
  expect(context).toContain("Selected on the board: api");
  for (const element of design.elements) {
    expect(context).toContain(`planned:${element.planned} (no runtime)`);
    expect(context).toContain(JSON.stringify(element.description));
    expect(context).toContain(JSON.stringify(element.technology));
  }
});

it("retains context-only designs and implemented relationship display metadata", () => {
  const design = emptyDesign();
  design.architecture = {
    system: { name: "Links", description: "Share short links." },
    nodes: [],
    relationships: [],
  };
  expect(designSummary(design, [])).not.toContain("The design is empty");
  expect(designSummary(design, [])).toContain(JSON.stringify(design.architecture));
  design.connections.push({
    id: "web-api",
    kind: "calls",
    from: { element: "web" },
    to: { element: "api" },
    label: "Creates links",
    protocol: "HTTPS/JSON",
    interaction: "Request / response",
  });
  expect(designSummary(design, [])).toContain(
    'display {"label":"Creates links","protocol":"HTTPS/JSON","interaction":"Request / response"}',
  );
});

it("instructs the assistant about C4 boundaries, replacement semantics and honest availability", () => {
  expect(INSTRUCTIONS).toContain("at most 15 containers");
  expect(INSTRUCTIONS).toContain("C1 descriptions have no protocol/technology");
  expect(INSTRUCTIONS).toContain("frontend families belong on frontend hosts");
  expect(INSTRUCTIONS).toContain("setArchitecture replaces the entire architecture");
  expect(INSTRUCTIONS).toContain("Never invent planned IDs");
  expect(INSTRUCTIONS).toContain("they have no runtime and block generation");
});

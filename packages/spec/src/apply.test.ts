import { describe, expect, it } from "vitest";
import { applyOperations } from "./apply.ts";
import type { DesignDocument } from "./design.ts";
import { emptyDesign } from "./design.ts";
import { studioArchitectureExample } from "./studio-examples/index.ts";
import { validateDesign } from "./validate.ts";

const tinyurl = () => studioArchitectureExample("studio-tinyurl").design;

function accepted(design: DesignDocument, ops: unknown[]) {
  const result = applyOperations(design, ops as never);
  if (!result.ok) throw new Error(JSON.stringify(result.errors));
  return result.design;
}
function rejected(design: DesignDocument, ops: unknown[]) {
  const result = applyOperations(design, ops as never);
  if (result.ok) throw new Error("The batch was accepted.");
  return result.errors;
}
const codes = (errors: { code: string }[]) => errors.map((e) => e.code);

describe("applyOperations", () => {
  it("bumps the revision once per batch and never mutates its input", () => {
    const design = tinyurl();
    const before = structuredClone(design);
    const next = accepted(design, [
      { op: "updateElement", id: "redirect", name: "Redirector" },
      { op: "updateElement", id: "analytics", description: "Rolls up clicks." },
    ]);
    expect(next.revision).toBe(design.revision + 1);
    expect(next.elements.find((e) => e.id === "redirect")?.name).toBe("Redirector");
    expect(design).toEqual(before);
  });

  it("rejects the whole batch when any operation fails", () => {
    const design = tinyurl();
    const errors = rejected(design, [
      { op: "updateElement", id: "redirect", name: "Redirector" },
      { op: "removeElement", id: "nope" },
    ]);
    expect(errors).toEqual([
      expect.objectContaining({ code: "UNKNOWN_REFERENCE", target: { op: 1 } }),
    ]);
  });

  it("reports malformed operations with their index, and refuses an empty batch", () => {
    const errors = rejected(tinyurl(), [
      { op: "updateElement", id: "redirect", name: "ok" },
      { op: "addAnnotation", annotation: {} },
    ]);
    expect(errors[0]).toMatchObject({ code: "INVALID_OPERATION", target: { op: 1 } });
    expect(codes(rejected(tinyurl(), []))).toEqual(["INVALID_OPERATION"]);
  });

  it("refuses a stale baseRevision", () => {
    const result = applyOperations(tinyurl(), [{ op: "removeElement", id: "url-cache" }], {
      baseRevision: 7,
    });
    expect(result).toMatchObject({ ok: false, errors: [{ code: "REVISION_CONFLICT" }] });
  });

  it("needs an architecture before system text or studio intent", () => {
    for (const op of [
      { op: "updateArchitectureSystem", name: "Shortener" },
      { op: "setStudio", studio: null },
    ])
      expect(codes(rejected(emptyDesign(), [op]))).toEqual(["INVALID_OPERATION"]);
    const named = accepted(tinyurl(), [{ op: "updateArchitectureSystem", name: "Shortener" }]);
    expect(named.architecture?.system.name).toBe("Shortener");
  });

  it("setArchitecture replaces or clears the architecture, but never leaves bad studio data", () => {
    const design = tinyurl();
    const architecture = structuredClone(design.architecture);
    if (!architecture?.studio) throw new Error("TinyURL has a studio model.");
    architecture.studio.elements = architecture.studio.elements.filter(
      (b) => b.element !== "redirect",
    );
    // Dropping a binding still referenced by packages and components is structural.
    expect(rejected(design, [{ op: "setArchitecture", architecture }]).length).toBeGreaterThan(0);

    // Clearing studio intent leaves every element unbound, which is structural too.
    expect(codes(rejected(design, [{ op: "setStudio", studio: null }]))).toContain(
      "CONFIG_INVALID",
    );

    const cleared = accepted(emptyDesign(), [
      {
        op: "setArchitecture",
        architecture: { system: { name: "S", description: "" }, nodes: [], relationships: [] },
      },
      { op: "setArchitecture", architecture: null },
    ]);
    expect(cleared.architecture).toBeUndefined();
  });

  it("addElement refuses taken IDs and elements without studio settings", () => {
    expect(
      codes(rejected(tinyurl(), [{ op: "addElement", element: { id: "url-db", name: "Again" } }])),
    ).toEqual(["DUPLICATE_ID"]);
    expect(
      codes(rejected(tinyurl(), [{ op: "addElement", element: { id: "loose", name: "Loose" } }])),
    ).toEqual(["CONFIG_INVALID"]);
  });

  it("updateElement needs an existing element", () => {
    expect(codes(rejected(tinyurl(), [{ op: "updateElement", id: "x", name: "X" }]))).toEqual([
      "UNKNOWN_REFERENCE",
    ]);
  });

  it("removeElement never cascades resource ownership", () => {
    // Redirect owns the URL cache and the click queue; they must be removed or reassigned too.
    // Removing it also cuts the click path off from the user.
    expect(codes(rejected(tinyurl(), [{ op: "removeElement", id: "redirect" }]))).toEqual([
      "UNKNOWN_REFERENCE",
      "UNKNOWN_REFERENCE",
      "LANE_INVALID",
      "LANE_INVALID",
      "LANE_INVALID",
    ]);
  });

  it("removeElement takes its connections, bindings, components and links with it", () => {
    const design = tinyurl();
    design.architecture?.studio?.packages.push({
      id: "link-platform",
      name: "Link platform",
      description: "",
      members: ["shorten", "redirect"],
    });
    const next = accepted(design, [
      { op: "removeElement", id: "url-cache" },
      { op: "removeElement", id: "click-events" },
      { op: "removeElement", id: "analytics-store" },
      { op: "removeElement", id: "analytics" },
      { op: "removeElement", id: "redirect" },
    ]);
    const studio = next.architecture?.studio;
    expect(next.elements.some((e) => e.id === "redirect")).toBe(false);
    expect(
      next.connections.filter((c) => c.from.element === "redirect" || c.to.element === "redirect"),
    ).toEqual([]);
    expect(studio?.elements.some((b) => b.element === "redirect")).toBe(false);
    expect(studio?.components?.some((c) => c.host === "redirect")).toBe(false);
    expect(studio?.componentConnections?.some((l) => l.from.startsWith("redirect-"))).toBe(false);
    // The two-member package falls below two members and dissolves.
    expect(studio?.packages).toEqual([]);
    expect(studio?.components?.some((c) => c.host === "shorten")).toBe(true);
  });

  it("connect refuses taken IDs, missing ends and self-connections", () => {
    const connection = (id: string, from: string, to: string) => ({
      op: "connect",
      connection: {
        id,
        kind: "calls",
        from: { element: from },
        to: { element: to },
        planned: { label: "Calls" },
      },
    });
    expect(
      codes(rejected(tinyurl(), [connection("redirect-cache", "shorten", "redirect")])),
    ).toEqual(["DUPLICATE_ID"]);
    expect(codes(rejected(tinyurl(), [connection("c1", "shorten", "ghost")]))).toContain(
      "UNKNOWN_REFERENCE",
    );
    expect(codes(rejected(tinyurl(), [connection("c2", "redirect", "redirect")]))).toContain(
      "CONFIG_INVALID",
    );
  });

  it("updatePlannedConnection changes only the given fields of an existing connection", () => {
    const next = accepted(tinyurl(), [
      { op: "updatePlannedConnection", id: "stats-read", label: "Reads counts" },
    ]);
    expect(next.connections.find((c) => c.id === "stats-read")?.planned).toMatchObject({
      label: "Reads counts",
      protocol: "SQL",
    });
    expect(
      codes(rejected(tinyurl(), [{ op: "updatePlannedConnection", id: "x", label: "y" }])),
    ).toEqual(["UNKNOWN_REFERENCE"]);
  });

  it("disconnect removes the connection, its binding and the component links tracing it", () => {
    // The URL database stays reachable through the Shorten service.
    const next = accepted(tinyurl(), [{ op: "disconnect", id: "redirect-db" }]);
    expect(next.connections.some((c) => c.id === "redirect-db")).toBe(false);
    const studio = next.architecture?.studio;
    expect(studio?.connections.some((b) => b.connection === "redirect-db")).toBe(false);
    expect(studio?.componentConnections?.some((l) => l.id === "redirect-data-reads")).toBe(false);
    expect(codes(rejected(tinyurl(), [{ op: "disconnect", id: "nope" }]))).toEqual([
      "UNKNOWN_REFERENCE",
    ]);
  });
});

describe("validateDesign", () => {
  it("finds nothing wrong with the TinyURL study", () => {
    expect(validateDesign(tinyurl())).toEqual([]);
  });

  it("reports duplicate IDs, unbound elements, missing ends and self-connections", () => {
    const design = tinyurl();
    const first = design.connections[0];
    if (!first) throw new Error("TinyURL has connections.");
    design.elements.push({ id: "url-db", name: "Copy" }, { id: "loose", name: "Loose" });
    design.connections.push(
      { ...first, id: "dangling", to: { element: "ghost" } },
      { ...first, id: "loop", to: first.from },
    );
    const findings = validateDesign(design).map((f) => [f.code, f.target]);
    expect(findings).toEqual(
      expect.arrayContaining([
        ["DUPLICATE_ID", { element: "url-db" }],
        ["CONFIG_INVALID", { element: "loose" }],
        ["UNKNOWN_REFERENCE", { connection: "dangling" }],
        ["CONFIG_INVALID", { connection: "loop" }],
      ]),
    );
  });
});

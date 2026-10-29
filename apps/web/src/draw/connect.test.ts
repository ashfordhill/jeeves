import { builtinRegistry } from "@jeeves/registry";
import {
  applyOperations,
  type DesignDocument,
  emptyDesign,
  type OperationInput,
} from "@jeeves/spec";
import { describe, expect, it } from "vitest";
import { planConnect } from "./connect.ts";

const registry = builtinRegistry();
const ref = (id: string) => ({ id, version: "0.1.0" });

function design(ops: OperationInput[]): DesignDocument {
  const result = applyOperations(emptyDesign(), ops, registry);
  if (!result.ok) throw new Error(result.errors.map((e) => e.message).join(" "));
  return result.design;
}

const board = design([
  { op: "addElement", element: { id: "links", name: "Links", template: ref("http-service") } },
  { op: "addElement", element: { id: "db", name: "Links DB", template: ref("postgres") } },
  { op: "addElement", element: { id: "web", name: "Web", template: ref("web-app") } },
  {
    op: "addAttachment",
    element: "links",
    attachment: { id: "links-api", template: ref("rest-api-server") },
  },
  { op: "addAnnotation", annotation: { id: "note", kind: "note", text: "Later" } },
]);

function applies(ops: OperationInput[]) {
  return applyOperations(board, ops, registry).ok;
}

describe("planConnect", () => {
  it("infers the connection kind from the ports", () => {
    const plan = planConnect(board, registry, { element: "links" }, { element: "db" });
    expect(plan).toEqual({
      ok: true,
      ops: [
        {
          op: "connect",
          connection: {
            id: "links-to-db",
            kind: "uses-database",
            from: { element: "links" },
            to: { element: "db" },
          },
        },
      ],
    });
    expect(plan.ok === true && applies(plan.ops)).toBe(true);
  });

  it("refuses a reversed database connection with the port rule", () => {
    const plan = planConnect(board, registry, { element: "db" }, { element: "links" });
    expect(plan.ok).toBe(false);
    if (plan.ok !== false) return;
    expect(plan.reason).toBe(
      `"Links DB" can't start a "uses-database" connection to "Links"; it goes the other way.`,
    );
    expect(plan.fixes[0]?.label).toBe(`Connect from "Links" to "Links DB" instead.`);
    expect(plan.fixes[0] && applies(plan.fixes[0].ops)).toBe(true);
  });

  it("explains a connection no port allows", () => {
    const plan = planConnect(board, registry, { element: "web" }, { element: "db" });
    expect(plan).toEqual({
      ok: false,
      reason: `"Web" has no outgoing "uses-database" connection.`,
      fixes: [],
    });
  });

  it("suggests adding a client when a web app connects to a REST server", () => {
    const plan = planConnect(
      board,
      registry,
      { element: "web" },
      { element: "links", attachment: "links-api" },
    );
    expect(plan.ok).toBe(false);
    if (plan.ok !== false) return;
    const fix = plan.fixes.find((f) => f.ops.some((op) => op.op === "addAttachment"));
    expect(fix?.label).toMatch(/REST API client/);
    expect(fix && applies(fix.ops)).toBe(true);
  });

  it("suggests the existing server attachment when connecting a client to the service itself", () => {
    const withClient = design([
      ...([
        {
          op: "addElement",
          element: { id: "links", name: "Links", template: ref("http-service") },
        },
        { op: "addElement", element: { id: "web", name: "Web", template: ref("web-app") } },
        {
          op: "addAttachment",
          element: "links",
          attachment: { id: "links-api", template: ref("rest-api-server") },
        },
        {
          op: "addAttachment",
          element: "web",
          attachment: { id: "web-client", template: ref("rest-api-client") },
        },
      ] satisfies OperationInput[]),
    ]);
    const plan = planConnect(
      withClient,
      registry,
      { element: "web", attachment: "web-client" },
      { element: "links" },
    );
    expect(plan.ok).toBe(false);
    if (plan.ok !== false) return;
    const fix = plan.fixes[0];
    expect(fix?.ops).toEqual([
      expect.objectContaining({
        op: "connect",
        connection: expect.objectContaining({
          kind: "calls",
          to: { element: "links", attachment: "links-api" },
        }),
      }),
    ]);
    expect(fix && applyOperations(withClient, fix.ops, registry).ok).toBe(true);
  });

  it("draws a plain arrow when an annotation is involved", () => {
    const plan = planConnect(board, registry, { annotation: "note" }, { element: "links" });
    expect(plan).toEqual({
      ok: true,
      ops: [
        {
          op: "addAnnotation",
          annotation: { id: "arrow", kind: "arrow", from: "note", to: "links" },
        },
      ],
    });
  });

  it("refuses connecting an item to itself", () => {
    expect(planConnect(board, registry, { element: "links" }, { element: "links" }).ok).toBe(false);
  });
});

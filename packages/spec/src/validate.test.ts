import { describe, expect, it } from "vitest";
import { applyOperations } from "./apply.ts";
import type { DesignDocument } from "./design.ts";
import { blocksGenerate, type Finding, type FindingCode, findingCatalog } from "./findings.ts";
import { design, sampleDesign, t, testLookup } from "./test-support.ts";
import { validateDesign } from "./validate.ts";

const codes = (doc: DesignDocument) => validateDesign(doc, testLookup).map((f) => f.code);

function edit(change: (doc: DesignDocument) => void): DesignDocument {
  const doc = sampleDesign();
  change(doc);
  return doc;
}

/**
 * One case per finding code. Typed as a full record so adding a code without a test is a type
 * error.
 */
// Recipe compatibility depends on the generator's source catalog; covered in recipes.test.ts.
const cases: Record<
  Exclude<FindingCode, "RECIPE_INCOMPATIBLE">,
  { name: string; findings: () => Finding[]; target?: object }[]
> = {
  DUPLICATE_ID: [
    {
      name: "an attachment reuses an element ID",
      findings: () =>
        validateDesign(
          edit((d) => {
            d.elements[2]?.attachments.push({
              id: "api-db",
              template: t("client"),
              config: {},
              notes: "",
            });
          }),
          testLookup,
        ),
      target: { attachment: "api-db" },
    },
  ],
  UNKNOWN_REFERENCE: [
    {
      name: "a connection points at a missing element",
      findings: () =>
        validateDesign(
          edit((d) => {
            d.connections.push({
              id: "c-x",
              kind: "depends-on",
              from: { element: "api" },
              to: { element: "nope" },
            });
          }),
          testLookup,
        ),
      target: { connection: "c-x" },
    },
    {
      name: "a connection names an attachment that belongs to a different element",
      findings: () =>
        validateDesign(
          edit((d) => {
            const call = d.connections[1];
            if (call) call.to = { element: "api-db", attachment: "api-server" };
          }),
          testLookup,
        ),
      target: { connection: "c-call" },
    },
    {
      name: "an arrow is bound to a missing item",
      findings: () =>
        validateDesign(
          edit((d) => {
            d.annotations.push({ id: "a2", kind: "arrow", to: "ghost" });
          }),
          testLookup,
        ),
      target: { annotation: "a2" },
    },
  ],
  UNKNOWN_TEMPLATE: [
    {
      name: "an element uses a template that doesn't exist",
      findings: () =>
        validateDesign(
          edit((d) => {
            const db = d.elements[1];
            if (db) db.template = { id: "mongo", version: "1.0.0" };
          }),
          testLookup,
        ),
      target: { element: "api-db" },
    },
  ],
  TEMPLATE_KIND_MISMATCH: [
    {
      name: "an element uses an attachment template",
      findings: () =>
        validateDesign(
          design({ elements: [{ id: "x", name: "X", template: t("server") }] }),
          testLookup,
        ),
      target: { element: "x" },
    },
    {
      name: "an attachment uses an element template",
      findings: () =>
        validateDesign(
          design({
            elements: [
              {
                id: "x",
                name: "X",
                template: t("svc"),
                attachments: [{ id: "y", template: t("db") }],
              },
            ],
          }),
          testLookup,
        ),
      target: { element: "x", attachment: "y" },
    },
  ],
  CONFIG_INVALID: [
    {
      name: "a config value has the wrong type",
      findings: () =>
        validateDesign(
          edit((d) => {
            const api = d.elements[0];
            if (api) api.config = { port: "eighty" };
          }),
          testLookup,
        ),
      target: { element: "api", path: ["port"] },
    },
    {
      name: "a config key is unknown",
      findings: () =>
        validateDesign(
          edit((d) => {
            const server = d.elements[0]?.attachments[0];
            if (server) server.config = { colour: "red" };
          }),
          testLookup,
        ),
      target: { element: "api", attachment: "api-server", path: ["colour"] },
    },
    {
      name: "an element without a template has config",
      findings: () =>
        validateDesign(
          design({ elements: [{ id: "pay", name: "Payments", template: null, config: { a: 1 } }] }),
          testLookup,
        ),
      target: { element: "pay" },
    },
  ],
  ATTACHMENT_INCOMPATIBLE: [
    {
      name: "the element has no slot for the attachment",
      findings: () =>
        validateDesign(
          edit((d) => {
            d.elements[2]?.attachments.push({
              id: "site-server",
              template: t("server"),
              config: {},
              notes: "",
            });
          }),
          testLookup,
        ),
      target: { element: "site", attachment: "site-server" },
    },
    {
      name: "the slot is full",
      findings: () =>
        validateDesign(
          edit((d) => {
            d.elements[0]?.attachments.push({
              id: "api-server-2",
              template: t("server"),
              config: {},
              notes: "",
            });
          }),
          testLookup,
        ),
      target: { element: "api", attachment: "api-server-2" },
    },
    {
      name: "the element needs a template first",
      findings: () =>
        validateDesign(
          design({
            elements: [
              {
                id: "pay",
                name: "Payments",
                template: null,
                attachments: [{ id: "pay-client", template: t("client") }],
              },
            ],
          }),
          testLookup,
        ),
      target: { element: "pay", attachment: "pay-client" },
    },
  ],
  PORT_INCOMPATIBLE: [
    {
      name: "the source has no outgoing port of that kind",
      findings: () =>
        validateDesign(
          edit((d) => {
            d.connections.push({
              id: "c-x",
              kind: "calls",
              from: { element: "site" },
              to: { element: "api" },
            });
          }),
          testLookup,
        ),
      target: { connection: "c-x" },
    },
    {
      name: "the target has no incoming port of that kind",
      findings: () =>
        validateDesign(
          edit((d) => {
            d.connections.push({
              id: "c-x",
              kind: "uses-database",
              from: { element: "api" },
              to: { element: "site" },
            });
          }),
          testLookup,
        ),
      target: { connection: "c-x" },
    },
    {
      name: "the port doesn't accept that element kind",
      findings: () =>
        validateDesign(
          edit((d) => {
            d.elements.push({
              id: "fake-db",
              name: "Fake",
              template: t("svc"),
              config: {},
              attachments: [],
              notes: "",
            });
            d.connections.push({
              id: "c-x",
              kind: "uses-database",
              from: { element: "api" },
              to: { element: "fake-db" },
            });
          }),
          testLookup,
        ),
      target: { connection: "c-x" },
    },
    {
      name: "an endpoint connects to itself",
      findings: () =>
        validateDesign(
          edit((d) => {
            d.connections.push({
              id: "c-x",
              kind: "depends-on",
              from: { element: "api" },
              to: { element: "api" },
            });
          }),
          testLookup,
        ),
      target: { connection: "c-x" },
    },
    {
      name: "an endpoint needs a template",
      findings: () =>
        validateDesign(
          edit((d) => {
            d.elements.push({
              id: "pay",
              name: "Payments",
              template: null,
              config: {},
              attachments: [],
              notes: "",
            });
            d.connections.push({
              id: "c-x",
              kind: "depends-on",
              from: { element: "api" },
              to: { element: "pay" },
            });
          }),
          testLookup,
        ),
      target: { connection: "c-x" },
    },
  ],
  PORT_MULTIPLICITY: [
    {
      name: "a single-connection port is used twice",
      findings: () =>
        validateDesign(
          edit((d) => {
            d.elements.push({
              id: "other",
              name: "Other",
              template: t("svc"),
              config: {},
              attachments: [{ id: "other-server", template: t("server"), config: {}, notes: "" }],
              notes: "",
            });
            d.connections.push({
              id: "c-x",
              kind: "calls",
              from: { element: "site", attachment: "site-client" },
              to: { element: "other", attachment: "other-server" },
            });
          }),
          testLookup,
        ),
      target: { connection: "c-x" },
    },
  ],
  DUPLICATE_CONNECTION: [
    {
      name: "the same connection is drawn twice",
      findings: () =>
        validateDesign(
          edit((d) => {
            d.connections.push({
              id: "c-db-2",
              kind: "uses-database",
              from: { element: "api" },
              to: { element: "api-db" },
            });
          }),
          testLookup,
        ),
      target: { connection: "c-db-2" },
    },
  ],
  NEEDS_TEMPLATE: [
    {
      name: "an element has no template",
      findings: () =>
        validateDesign(
          design({ elements: [{ id: "pay", name: "Payments", template: null }] }),
          testLookup,
        ),
      target: { element: "pay" },
    },
  ],
  CONFIG_REQUIRED: [
    {
      name: "a required config value without a default is missing",
      findings: () =>
        validateDesign(
          edit((d) => {
            const site = d.elements[2];
            if (site) site.config = {};
          }),
          testLookup,
        ),
      target: { element: "site", path: ["title"] },
    },
  ],
  UNCONNECTED_REQUIRED_PORT: [
    {
      name: "a client has no target",
      findings: () =>
        validateDesign(
          edit((d) => {
            d.connections = d.connections.filter((c) => c.kind !== "calls");
          }),
          testLookup,
        ),
      target: { element: "site", attachment: "site-client" },
    },
  ],
  INVALID_OPERATION: [
    {
      name: "an operation is malformed",
      findings: () => {
        const result = applyOperations(
          sampleDesign(),
          [{ op: "removeElement" } as never],
          testLookup,
        );
        return result.ok ? [] : result.errors;
      },
      target: { op: 0 },
    },
  ],
  REVISION_CONFLICT: [
    {
      name: "the base revision is stale",
      findings: () => {
        const result = applyOperations(
          { ...sampleDesign(), revision: 3 },
          [{ op: "removeElement", id: "api" }],
          testLookup,
          { baseRevision: 2 },
        );
        return result.ok ? [] : result.errors;
      },
      target: {},
    },
  ],
};

describe("validateDesign", () => {
  it("finds nothing wrong with a complete design", () => {
    expect(validateDesign(sampleDesign(), testLookup)).toEqual([]);
  });

  for (const [code, list] of Object.entries(cases)) {
    describe(code, () => {
      for (const c of list) {
        it(c.name, () => {
          const found = c.findings().filter((f) => f.code === code);
          expect(found).toHaveLength(1);
          const [f] = found;
          expect(f?.severity).toBe(findingCatalog[code as FindingCode].severity);
          expect(f?.message.length).toBeGreaterThan(10);
          if (c.target) expect(f?.target).toEqual(c.target);
        });
      }
    });
  }

  it("names known versions when a template version is missing", () => {
    const doc = edit((d) => {
      const db = d.elements[1];
      if (db) db.template = { id: "db", version: "9.0.0" };
    });
    const [f] = validateDesign(doc, testLookup);
    expect(f?.code).toBe("UNKNOWN_TEMPLATE");
    expect(f?.message).toContain("1.0.0");
  });

  it("doesn't pile port errors onto connections whose template is unknown", () => {
    const doc = edit((d) => {
      const db = d.elements[1];
      if (db) db.template = { id: "mongo", version: "1.0.0" };
    });
    expect(codes(doc)).toEqual(["UNKNOWN_TEMPLATE"]);
  });

  it("allows cycles between services", () => {
    const doc = edit((d) => {
      d.elements.push({
        id: "b",
        name: "B",
        template: t("svc"),
        config: {},
        attachments: [],
        notes: "",
      });
      d.connections.push(
        { id: "ab", kind: "depends-on", from: { element: "api" }, to: { element: "b" } },
        { id: "ba", kind: "depends-on", from: { element: "b" }, to: { element: "api" } },
      );
    });
    expect(codes(doc)).toEqual([]);
  });

  it("treats only error-level findings as blocking Generate", () => {
    expect(blocksGenerate([])).toBe(false);
    expect(blocksGenerate(cases.NEEDS_TEMPLATE[0]?.findings() ?? [])).toBe(true);
    expect(
      blocksGenerate([{ code: "NEEDS_TEMPLATE", severity: "warning", message: "x", target: {} }]),
    ).toBe(false);
  });
});

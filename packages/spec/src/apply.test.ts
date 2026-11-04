import { describe, expect, it } from "vitest";
import { applyOperations } from "./apply.ts";
import { type DesignDocument, upgradeDesign } from "./design.ts";
import { type OperationInput, type OperationType, operationTypes } from "./operations.ts";
import { subtypeDiscards } from "./subtype.ts";
import { sampleDesign, t, testLookup } from "./test-support.ts";

function apply(ops: OperationInput[], doc: DesignDocument = sampleDesign()) {
  return applyOperations(doc, ops, testLookup, { baseRevision: doc.revision });
}

function applied(ops: OperationInput[], doc?: DesignDocument): DesignDocument {
  const result = apply(ops, doc);
  if (!result.ok) throw new Error(JSON.stringify(result.errors, null, 2));
  return result.design;
}

/** Explicit case or deferred marker per operation type; the full record keeps new types visible. */
const opCases: Record<OperationType, (() => void) | undefined> = {
  // UX13 type compatibility only; new suite cases are deferred by the owner.
  updateArchitectureSystem: undefined,
  setStudio() {
    const architecture = {
      system: { name: "Studio", description: "" },
      nodes: [],
      relationships: [],
    };
    const studio = { version: 1 as const, elements: [], packages: [], connections: [] };
    const doc = applied([
      { op: "setArchitecture", architecture },
      { op: "setStudio", studio },
    ]);
    expect(doc.architecture?.studio).toEqual(studio);
    expect(applied([{ op: "setStudio", studio: null }], doc).architecture).toEqual(architecture);
  },
  updatePlannedConnection() {
    const input = sampleDesign();
    const connection = input.connections[0];
    if (!connection) throw new Error("The sample needs a connection.");
    connection.planned = {
      label: "Reads",
      protocol: "SQL",
      interaction: "Request / response",
      security: "Service identity",
    };
    const doc = applied(
      [
        {
          op: "updatePlannedConnection",
          id: connection.id,
          label: "Writes",
          security: "Private network",
        },
      ],
      input,
    );
    expect(doc.connections[0]?.planned).toEqual({
      ...connection.planned,
      label: "Writes",
      security: "Private network",
    });
  },
  updateConnection() {
    const input = sampleDesign();
    const doc = applied(
      [
        {
          op: "updateConnection",
          id: "c-db",
          label: "Persists stock records",
          protocol: "SQL",
          interaction: "Asynchronous",
        },
      ],
      input,
    );
    const expected = upgradeDesign(input);
    Object.assign(expected.connections[0]!, {
      label: "Persists stock records",
      protocol: "SQL",
      interaction: "Asynchronous",
    });
    expected.revision++;
    expect(doc).toEqual(expected);
    expect(input.connections[0]).not.toHaveProperty("label");
    expect(apply([{ op: "updateConnection", id: "missing", label: "Reads records" }]).ok).toBe(
      false,
    );
    expect(apply([{ op: "updateConnection", id: "c-db", protocol: "x".repeat(81) }]).ok).toBe(
      false,
    );
  },
  setArchitecture() {
    const architecture = {
      system: { name: "Inventory", description: "Keeps stock records" },
      nodes: [],
      relationships: [],
    };
    const doc = applied([{ op: "setArchitecture", architecture }]);
    expect(doc.architecture).toEqual(architecture);
    expect(applied([{ op: "setArchitecture", architecture: null }], doc)).not.toHaveProperty(
      "architecture",
    );
  },
  setRecipe() {
    const binding = { id: "qr-studio", version: "0.1.0", config: { analyticsDays: 30 } };
    const doc = applied([{ op: "setRecipe", recipe: binding }]);
    expect(doc.recipe).toEqual(binding);
    expect(applied([{ op: "setRecipe", recipe: null }], doc)).not.toHaveProperty("recipe");
    expect(sampleDesign()).not.toHaveProperty("recipe");
  },
  upgradeTemplate() {
    const document = sampleDesign();
    document.elements[0]!.template = { id: "http-service", version: "0.1.0" };
    const result = applyOperations(
      document,
      [
        {
          op: "upgradeTemplate",
          id: "api",
          from: { id: "http-service", version: "0.1.0" },
          to: { id: "http-service", version: "0.2.0" },
          revision: document.revision,
        },
      ],
      {
        get: (ref) =>
          ref.id === "http-service" && ["0.1.0", "0.2.0"].includes(ref.version)
            ? { ...testLookup.get(t("svc"))!, id: ref.id, version: ref.version }
            : testLookup.get(ref),
        versions: (id) => (id === "http-service" ? ["0.1.0", "0.2.0"] : testLookup.versions(id)),
      },
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const expected = upgradeDesign(document);
    expected.revision++;
    expected.elements[0]!.template!.version = "0.2.0";
    expect(result.design).toEqual(expected);
  },
  changeSubtype() {
    const doc = sampleDesign();
    const discarded = subtypeDiscards(doc, doc.elements[0]!);
    const changed = applied(
      [
        {
          op: "changeSubtype",
          id: "api",
          template: null,
          confirmation: { revision: doc.revision, discarded },
        },
      ],
      doc,
    );
    expect(changed.elements[0]).toMatchObject({ template: null, config: {}, attachments: [] });
    expect(
      changed.connections.every((c) => c.from.element !== "api" && c.to.element !== "api"),
    ).toBe(true);
  },
  addElement() {
    const doc = applied([
      {
        op: "addElement",
        element: { id: "worker", name: "Worker", template: t("svc"), config: { port: 9000 } },
      },
    ]);
    expect(doc.elements.at(-1)).toEqual({
      id: "worker",
      name: "Worker",
      template: t("svc"),
      config: { port: 9000 },
      attachments: [],
      notes: "",
    });
  },
  updateElement() {
    const doc = applied([{ op: "updateElement", id: "api", name: "Links", config: { port: 81 } }]);
    expect(doc.elements[0]).toMatchObject({
      name: "Links",
      config: { port: 81 },
      template: t("svc"),
    });
  },
  removeElement() {
    const doc = applied([{ op: "removeElement", id: "api" }]);
    expect(doc.elements.map((e) => e.id)).toEqual(["api-db", "site"]);
    expect(doc.connections).toEqual([]);
    expect(doc.annotations[1]).toEqual({ id: "arrow", kind: "arrow", from: "frame" });
  },
  addAttachment() {
    const doc = applied([
      {
        op: "addAttachment",
        element: "api",
        attachment: { id: "api-client", template: t("client") },
      },
      {
        op: "connect",
        connection: {
          id: "c-self",
          kind: "calls",
          from: { element: "api", attachment: "api-client" },
          to: { element: "api", attachment: "api-server" },
        },
      },
    ]);
    expect(doc.elements[0]?.attachments.map((a) => a.id)).toEqual(["api-server", "api-client"]);
  },
  updateAttachment() {
    const doc = applied([
      { op: "updateAttachment", id: "api-server", config: { basePath: "/v1" } },
    ]);
    expect(doc.elements[0]?.attachments[0]?.config).toEqual({ basePath: "/v1" });
  },
  removeAttachment() {
    const doc = applied([{ op: "removeAttachment", id: "api-server" }]);
    expect(doc.elements[0]?.attachments).toEqual([]);
    expect(doc.connections.map((c) => c.id)).toEqual(["c-db"]);
  },
  connect() {
    const doc = applied([
      { op: "addElement", element: { id: "b", name: "B", template: t("svc") } },
      {
        op: "connect",
        connection: {
          id: "c-b",
          kind: "depends-on",
          from: { element: "api" },
          to: { element: "b" },
        },
      },
    ]);
    expect(doc.connections.map((c) => c.id)).toEqual(["c-db", "c-call", "c-b"]);
  },
  disconnect() {
    const result = apply([{ op: "disconnect", id: "c-call" }]);
    expect(result.ok && result.design.connections.map((c) => c.id)).toEqual(["c-db"]);
    // Removing the client's target is allowed; it becomes a readiness finding.
    expect(result.ok && result.findings.map((f) => f.code)).toEqual(["UNCONNECTED_REQUIRED_PORT"]);
  },
  setNotes() {
    const doc = applied([
      { op: "setNotes", id: "api", notes: "Create short links." },
      { op: "setNotes", id: "site-client", notes: "Call POST /links." },
    ]);
    expect(doc.elements[0]?.notes).toBe("Create short links.");
    expect(doc.elements[2]?.attachments[0]?.notes).toBe("Call POST /links.");
  },
  addAnnotation() {
    const doc = applied([
      { op: "addAnnotation", annotation: { id: "n1", kind: "note", text: "Later" } },
    ]);
    expect(doc.annotations.at(-1)).toEqual({ id: "n1", kind: "note", text: "Later" });
  },
  updateAnnotation() {
    const doc = applied([
      { op: "updateAnnotation", id: "frame", title: "Back end" },
      { op: "updateAnnotation", id: "arrow", label: "owns", from: null },
    ]);
    expect(doc.annotations).toEqual([
      { id: "frame", kind: "frame", title: "Back end" },
      { id: "arrow", kind: "arrow", label: "owns", to: "api" },
    ]);
  },
  removeAnnotation() {
    const doc = applied([{ op: "removeAnnotation", id: "frame" }]);
    expect(doc.annotations).toEqual([{ id: "arrow", kind: "arrow", to: "api" }]);
  },
};

describe("applyOperations", () => {
  describe("each operation type", () => {
    for (const type of operationTypes) {
      const run = opCases[type];
      if (run) it(type, run);
      else it.todo(type);
    }
  });

  it("bumps the revision once per batch and leaves the input untouched", () => {
    const before = sampleDesign();
    const snapshot = structuredClone(before);
    const result = apply(
      [
        { op: "setNotes", id: "api", notes: "a" },
        { op: "setNotes", id: "api", notes: "b" },
      ],
      before,
    );
    expect(result.ok && result.design.revision).toBe(1);
    expect(result.ok && result.design.elements[0]?.notes).toBe("b");
    expect(before).toEqual(snapshot);
  });

  it("works without a base revision", () => {
    const result = applyOperations(
      sampleDesign(),
      [{ op: "setNotes", id: "api", notes: "x" }],
      testLookup,
    );
    expect(result.ok).toBe(true);
  });

  describe("all-or-nothing batches", () => {
    it("rejects the whole batch when a later op refers to something missing", () => {
      const before = sampleDesign();
      const snapshot = structuredClone(before);
      const result = apply(
        [
          { op: "setNotes", id: "api", notes: "changed" },
          { op: "removeElement", id: "ghost" },
        ],
        before,
      );
      expect(result).toEqual({
        ok: false,
        errors: [expect.objectContaining({ code: "UNKNOWN_REFERENCE", target: { op: 1 } })],
      });
      expect(before).toEqual(snapshot);
    });

    it("rejects the whole batch when the result is structurally invalid", () => {
      const result = apply([
        { op: "setNotes", id: "api", notes: "changed" },
        { op: "updateElement", id: "api", config: { port: 0 } },
      ]);
      expect(!result.ok && result.errors.map((e) => e.code)).toEqual(["CONFIG_INVALID"]);
    });

    it("rejects a whole batch with one malformed op, naming its index", () => {
      const result = apply([
        { op: "setNotes", id: "api", notes: "ok" },
        { op: "connect", connection: { id: "BAD ID" } } as never,
      ]);
      expect(
        !result.ok &&
          result.errors.every((e) => e.code === "INVALID_OPERATION" && e.target.op === 1),
      ).toBe(true);
    });

    it("rejects an empty batch", () => {
      const result = apply([]);
      expect(!result.ok && result.errors[0]?.code).toBe("INVALID_OPERATION");
    });

    it("lets a later op in the batch fix what an earlier op broke", () => {
      // Removing the server alone is fine; adding a second server, then removing the first, too.
      const doc = applied([
        {
          op: "addAttachment",
          element: "api",
          attachment: { id: "api-server-2", template: t("server") },
        },
        { op: "removeAttachment", id: "api-server" },
      ]);
      expect(doc.elements[0]?.attachments.map((a) => a.id)).toEqual(["api-server-2"]);
    });
  });

  it("returns REVISION_CONFLICT for a stale base revision and changes nothing", () => {
    const doc = { ...sampleDesign(), revision: 5 };
    const result = applyOperations(doc, [{ op: "removeElement", id: "api" }], testLookup, {
      baseRevision: 4,
    });
    expect(!result.ok && result.errors.map((e) => e.code)).toEqual(["REVISION_CONFLICT"]);
    expect(doc.elements).toHaveLength(3);
  });

  it("refuses an ID already in use", () => {
    const result = apply([
      { op: "addAnnotation", annotation: { id: "api", kind: "text", text: "clash" } },
    ]);
    expect(!result.ok && result.errors[0]).toMatchObject({
      code: "DUPLICATE_ID",
      target: { op: 0 },
    });
  });

  it("refuses fields that don't belong to the annotation's kind", () => {
    const result = apply([{ op: "updateAnnotation", id: "frame", text: "not a frame field" }]);
    expect(!result.ok && result.errors[0]).toMatchObject({
      code: "INVALID_OPERATION",
      target: { op: 0, annotation: "frame" },
    });
  });

  it("refuses an incompatible connection with an explanation", () => {
    const result = apply([
      {
        op: "connect",
        connection: { id: "c-x", kind: "calls", from: { element: "site" }, to: { element: "api" } },
      },
    ]);
    expect(!result.ok && result.errors[0]).toMatchObject({
      code: "PORT_INCOMPATIBLE",
      target: { connection: "c-x" },
      message: expect.stringContaining('no outgoing "calls"'),
    });
  });

  it("accepts edits that leave readiness findings, and reports them", () => {
    const result = apply([
      {
        op: "addElement",
        element: { id: "pay", name: "Payments", template: null, notes: "Stripe checkout" },
      },
    ]);
    expect(result.ok && result.findings.map((f) => f.code)).toEqual(["NEEDS_TEMPLATE"]);
  });

  it("doesn't let an existing structural problem block unrelated edits", () => {
    const broken = sampleDesign();
    const db = broken.elements[1];
    if (db) db.template = { id: "retired", version: "1.0.0" };
    const result = apply([{ op: "setNotes", id: "api", notes: "still editable" }], broken);
    expect(result.ok && result.findings.map((f) => f.code)).toEqual(["UNKNOWN_TEMPLATE"]);
    // Fixing it is an ordinary edit too.
    const fixed = apply(
      [
        {
          op: "changeSubtype",
          id: "api-db",
          template: t("db"),
          confirmation: { revision: broken.revision, discarded: subtypeDiscards(broken, db!) },
        },
      ],
      broken,
    );
    expect(fixed.ok && fixed.findings).toEqual([]);
  });

  it("refuses a template change that strands attachments", () => {
    const result = apply([{ op: "updateElement", id: "api", template: null }]);
    expect(!result.ok && result.errors.map((e) => e.code)).toContain("INVALID_OPERATION");
  });

  it("round-trips through JSON", () => {
    const doc = applied([{ op: "setNotes", id: "api", notes: "x" }]);
    expect(JSON.parse(JSON.stringify(doc))).toEqual(doc);
  });
});

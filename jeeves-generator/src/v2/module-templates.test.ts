import { type DesignDocument, designGeneration, moduleStatuses } from "@jeeves/spec";
import { describe, expect, it } from "vitest";
import {
  moduleAuthored,
  tileLevelTwin,
} from "../../../jeeves/packages/spec/src/fixtures/v2-modules.ts";
import { loadLocalV2Registry } from "../../templates/local-v2/index.ts";
import { assembleV2 } from "./assemble.ts";

const registry = loadLocalV2Registry();
const text = (bytes: Uint8Array | undefined) => new TextDecoder().decode(bytes);

/** Contract section 3: each of v2's seven installed selections becomes its lead's selection. */
/** V3-06 (v3 contract, section 2 and question 4): the Creator check also leads its own sign-in,
 * which the tile-level twin has no selection for (its multipart binds the guard). */
const signIn = "upload-auth";
const leads: Record<string, string> = {
  "owned-upload": "upload-multipart",
  lifecycle: "handler-writer",
  hls: "transcoder-encoder",
  "ready-reader": "watch-cache-reader",
  counter: "counter-sum",
  projection: "indexer-writer",
  query: "search-query",
};
/** Fixed values v2 declares that a new tile or module leaves to the template (contract section 3):
 * they appear only as `inputs` of the application bindings. */
const declaredFixed = [
  "host.minReplicas",
  "host.maxReplicas",
  "cache.eviction",
  "cache.topology",
  "source.readReplicas",
  "state.readReplicas",
  "state.readRouting",
];

/** The twin's selections named by their leads, in the module-authored design's order. */
function mapped(twin: DesignDocument, authored: DesignDocument) {
  const design = structuredClone(twin);
  const generation = designGeneration(design);
  if (!generation) throw Error("The twin has a generation");
  for (const selection of generation.selections) {
    selection.id = leads[selection.id] ?? selection.id;
    if (selection.binding.kind === "asset-lifecycle")
      selection.binding.upload = leads[selection.binding.upload] ?? selection.binding.upload;
  }
  const order = (designGeneration(authored)?.selections ?? []).map((item) => item.id);
  generation.selections.sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id));
  return design;
}

type Binding = { id: string; inputs: Record<string, string | number> };
const bindings = (content: string): { head: string; rows: Binding[] } => ({
  head: content.slice(0, content.indexOf("= [")),
  rows: JSON.parse(content.slice(content.indexOf("= [") + 2, content.lastIndexOf(";"))),
});

describe("module-authored v2 and its tile-level twin", () => {
  const twin = tileLevelTwin();
  const authored = moduleAuthored(twin, registry.installed);
  const tiles = assembleV2({ designJson: JSON.stringify(mapped(twin, authored)) }, registry);
  const modules = assembleV2({ designJson: JSON.stringify(authored) }, registry);
  const payload = (bundle: typeof tiles) =>
    new Map(
      bundle.files
        .filter(
          (file) => !file.path.startsWith(".jeeves/") && !file.path.startsWith("diagnostics/"),
        )
        .map((file) => [file.path, file.bytes]),
    );

  it("select the same seven templates with the same bindings, and the Creator check's sign-in", () => {
    expect(tiles.report.findings).toEqual([]);
    expect(modules.report.findings).toEqual([]);
    const templates = (bundle: typeof tiles) =>
      bundle.manifest.templates.filter(
        (item) => item.ref.id !== "module-stub" && item.selection !== signIn,
      );
    expect(templates(modules)).toEqual(templates(tiles));
    expect(
      templates(modules)
        .map((item) => item.selection)
        .sort(),
    ).toEqual(Object.values(leads).sort());
    expect(
      modules.manifest.templates
        .filter((item) => item.selection === signIn)
        .map((item) => item.ref.id),
    ).toEqual(["verified-identity"]);
    expect(tiles.manifest.templates.some((item) => item.ref.id === "verified-identity")).toBe(
      false,
    );
    const normalized = (bundle: typeof tiles) =>
      JSON.parse(text(bundle.files.find((file) => file.path === ".jeeves/normalized.json")?.bytes))
        .selections.filter(
          (item: { binding: { kind: string } }) =>
            item.binding.kind !== "module-stub" && item.binding.kind !== "verified-identity",
        )
        .map((item: { id: string; binding: unknown; host: string }) => [
          item.id,
          item.host,
          item.binding,
        ]);
    expect(normalized(modules)).toEqual(normalized(tiles));
  });

  it("emit the same template payload, apart from the two stubs, v2's declared fixed values and the sign-in row", () => {
    const a = payload(tiles);
    const b = payload(modules);
    // Only the two stubs (View count reader, View publisher) add files.
    expect([...b.keys()].filter((path) => !a.has(path))).toEqual([
      "src/modules/dependencies.ts",
      "src/modules/watch/watch-counts.slots.ts",
      "src/modules/watch/watch-counts.ts",
      "src/modules/watch/watch-views.slots.ts",
      "src/modules/watch/watch-views.ts",
    ]);
    expect([...a.keys()].filter((path) => !b.has(path))).toEqual([]);
    const bindingsFile = "src/features/application-bindings.ts";
    expect(
      [...a.keys()].filter(
        (path) => path !== bindingsFile && text(a.get(path)) !== text(b.get(path)),
      ),
    ).toEqual([]);
    // The application bindings differ only by the fixed values v2 declares explicitly.
    const before = bindings(text(a.get(bindingsFile)));
    const all = bindings(text(b.get(bindingsFile)));
    expect(all.head).toBe(before.head);
    // The sign-in adds one row, with its Sign-in and fixed JWT.
    expect(all.rows.filter((row) => row.id === signIn)).toEqual([
      {
        id: signIn,
        kind: "verified-identity",
        host: "upload",
        identity: "identity",
        inputs: { "guard.credential": "jwt", "guard.signIn": "required" },
        resources: {},
      },
    ]);
    const after = { ...all, rows: all.rows.filter((row) => row.id !== signIn) };
    const fixed = new Set(
      tiles.report.settings
        .filter((item) => item.status === "fixed")
        .map((item) => `${item.selection}/${item.input}`),
    );
    const dropped: string[] = [];
    const expected = before.rows.map((row) => {
      const other = after.rows.find((item) => item.id === row.id);
      const inputs = Object.fromEntries(
        Object.entries(row.inputs).filter(([key]) => {
          if (other && key in other.inputs) return true;
          dropped.push(`${row.id}/${key}`);
          return false;
        }),
      );
      return { ...row, inputs };
    });
    expect(after.rows).toEqual(expected);
    expect(dropped.length).toBeGreaterThan(0);
    for (const item of dropped) {
      expect(fixed.has(item), item).toBe(true);
      expect(declaredFixed, item).toContain(item.slice(item.indexOf("/") + 1));
    }
    // The lifecycle reads its pool and statement timeout from the Lifecycle writer.
    expect(after.rows.find((row) => row.id === "handler-writer")?.inputs).toMatchObject({
      "state.poolSize": 10,
      "state.statementTimeoutMs": 2000,
    });
  });

  it("report each module, 20 of them Template, with their templates' files", () => {
    const rows = modules.report.modules ?? [];
    expect(rows).toHaveLength(22);
    expect(rows.filter((row) => row.status !== "template").map((row) => row.module)).toEqual([
      "watch-counts",
      "watch-views",
    ]);
    expect(rows.map((row) => row.status)).toEqual(
      moduleStatuses(authored).map((row) => row.status),
    );
    const files = (id: string) => rows.find((row) => row.module === id)?.files ?? [];
    // A part lists its lead's template files; a stub only its own.
    expect(files("handler-consumer")).toEqual(files("handler-writer"));
    expect(files("handler-writer")).toContain("src/runtime/asset-lifecycle.ts");
    expect(files("watch-details")).toContain("src/features/positive-cache-bindings.ts");
    expect(rows.find((row) => row.module === signIn)).toMatchObject({
      status: "template",
      template: "verified-identity",
      selection: signIn,
    });
    expect(files("watch-counts")).toEqual([
      "src/modules/dependencies.ts",
      "src/modules/watch/watch-counts.slots.ts",
      "src/modules/watch/watch-counts.ts",
    ]);
    expect(tiles.report.modules).toBeUndefined();
  });
});

import {
  applyOperations,
  buildSupportedAuthoringCommand,
  type DesignDocument,
  type StudioCommand,
} from "@jeeves/spec";
import { describe, expect, it } from "vitest";
import { searchStackDesign } from "../../../jeeves/packages/spec/src/fixtures/search-stack.ts";
import { stubStackDesign } from "../../../jeeves/packages/spec/src/fixtures/stub-stack.ts";
import { runStudioCommands } from "../../../jeeves/packages/spec/src/fixtures/v2-modules.ts";
import { loadLocalV2Registry } from "../../templates/local-v2/index.ts";
import { canonicalJson } from "../json.ts";
import { assembleV2 } from "./assemble.ts";

const registry = loadLocalV2Registry();
const on: StudioCommand = { type: "setRunnableProcesses", on: true };
const assemble = (design: DesignDocument) =>
  assembleV2({ designJson: canonicalJson(design) }, registry);
type Bundle = ReturnType<typeof assemble>;
const text = (bundle: Bundle, path: string) => {
  const file = bundle.files.find((item) => item.path === path);
  if (!file) throw new Error(`Missing ${path}`);
  return new TextDecoder().decode(file.bytes);
};
const has = (bundle: Bundle, path: string) => bundle.files.some((item) => item.path === path);
const json = (bundle: Bundle, path: string) => JSON.parse(text(bundle, path));
type Row = {
  tile: string;
  settings: { setting: string; value: number; origin: string; selection?: string }[];
  routes: { method: string; path: string; answers: string }[];
  loops: { queue: string; module: string; answers: string }[];
  templates: { selection: string; template: string; level: string }[];
  hooks: { selection: string; file: string; hooks: string[] }[];
};
type Processes = {
  runnable: boolean;
  tiles: Row[];
  delivery?: { cdn: string; name: string; path?: string; bucket?: string; answers: string }[];
};
const processes = (bundle: Bundle) =>
  (bundle.report as unknown as { processes: Processes }).processes;
const row = (bundle: Bundle, tile: string) => {
  const found = processes(bundle).tiles.find((item) => item.tile === tile);
  if (!found) throw new Error(`No process ${tile}`);
  return found;
};
const gap = (bundle: Bundle, id: string) => bundle.report.gaps.find((item) => item.id === id);
type Services = Record<string, { depends_on?: object; [key: string]: unknown }>;
/** The tile edit the Options form sends, through the supported authoring command. */
function edit(design: DesignDocument, element: string, change: Record<string, unknown>) {
  const settings = {
    ...design.architecture?.studio?.elements.find((item) => item.element === element)?.settings,
    ...change,
  };
  const command = { type: "edit", element, settings } as StudioCommand;
  const batch = buildSupportedAuthoringCommand(design, command, registry.installed);
  const result = applyOperations(design, batch.ops, { baseRevision: batch.baseRevision });
  if (!result.ok) throw new Error(JSON.stringify(result.errors));
  return result.design;
}

describe("the search stack (V3-08)", () => {
  const stack = assemble(runStudioCommands(searchStackDesign(), [on]));
  const off = assemble(searchStackDesign());

  it("mounts search projection and query on hooks files, with no placeholder left", () => {
    expect(stack.report.findings).toEqual([]);
    expect(processes(stack).runnable).toBe(true);
    expect(row(stack, "indexer").templates).toEqual([
      { selection: "index-writer", template: "search-projection", level: "mounted" },
    ]);
    expect(row(stack, "search-api").templates).toEqual([
      { selection: "item-search", template: "search-query", level: "mounted" },
    ]);
    expect(row(stack, "search-api").routes.map((route) => route.answers)).toEqual([
      "200 once ready, 503 before and while draining",
      '400 SEARCH_QUERY for a bad q or page; 501 "Not implemented: mapping for Index writer" until its hooks are written; then {q, page, pageSize, total, hits}, 20 to a page',
    ]);
    expect(
      [...row(stack, "indexer").hooks, ...row(stack, "search-api").hooks].map((item) => [
        item.file,
        item.hooks,
      ]),
    ).toEqual([
      [
        "src/modules/indexer/index-writer.hooks.ts",
        ["mapping", "document.parse", "document.id", "document.version", "event"],
      ],
      ["src/modules/search-api/item-search.hooks.ts", ["preset", "hit"]],
    ]);
    // The query reads the Index writer's mapping and document from its hooks file.
    const query = text(stack, "src/processes/search-api.ts");
    expect(query).toContain(
      'import { indexWriterHooks } from "../modules/indexer/index-writer.hooks.ts";',
    );
    expect(query).toContain(
      "return createSearchHandler({ client, index, indexHooks, hooks: itemSearchHooks() });",
    );
    expect(text(stack, "src/modules/search-api/item-search.hooks.ts")).toContain(
      'import type { IndexWriterDocument } from "../indexer/index-writer.hooks.ts";',
    );
    for (const [file, hook, lead] of [
      ["src/modules/indexer/index-writer.hooks.ts", "mapping", "Index writer"],
      ["src/modules/indexer/index-writer.hooks.ts", "event", "Index writer"],
      ["src/modules/search-api/item-search.hooks.ts", "preset", "Item search"],
      ["src/modules/search-api/item-search.hooks.ts", "hit", "Item search"],
    ] as const)
      expect(text(stack, file)).toContain(`throw new NotImplemented("${hook} for ${lead}");`);
    expect(has(stack, "src/runtime/tile-search.ts")).toBe(true);
    // Its hooks are custom work; the processes assert the index, so no mapping is contributed.
    expect(gap(stack, "search-application-bindings")).toMatchObject({
      status: "custom",
      required: true,
    });
    expect(gap(stack, "search-mappings")).toBeUndefined();
    const services = json(stack, "compose.yaml").services as Services;
    expect(services["setup-search"]).toBeUndefined();
    expect(services["app-indexer"]?.depends_on).toEqual({
      "local-broker": { condition: "service_healthy" },
      "search-items-index": { condition: "service_healthy" },
    });
    expect(services["app-search-api"]?.depends_on).toEqual({
      "search-items-index": { condition: "service_healthy" },
    });
    // Off, search keeps its gaps and nothing runs.
    expect(gap(off, "search-application-bindings")?.status).toBe("unfinished");
    expect(gap(off, "search-mappings")?.status).toBe("unfinished");
    expect(has(off, "src/runtime/tile-search.ts")).toBe(false);
  });

  it("gives each consumer of a topic in one tile its own subscriber queue (review row 6)", () => {
    expect(row(stack, "auditor").loops.map((loop) => [loop.queue, loop.module])).toEqual([
      ["item-events--item-auditor", "item-auditor"],
      ["item-events--item-notifier", "item-notifier"],
    ]);
    // A tile with one consumer of the topic keeps the tile's queue.
    expect(row(stack, "indexer").loops.map((loop) => loop.queue)).toEqual(["item-events--indexer"]);
    expect(json(stack, "infra/local.json").broker).toEqual([
      {
        resource: "item-events",
        exchange: "item-events",
        queues: ["item-events--indexer", "item-events--item-auditor", "item-events--item-notifier"],
      },
    ]);
    expect(text(stack, "src/features/search-bindings.ts")).toContain(
      '"queue":"item-events--indexer"',
    );
    // Off, every subscriber is its tile's (nothing consumes).
    expect(json(off, "infra/local.json").broker).toEqual([
      { resource: "item-events", exchange: "item-events", queues: ["item-events--indexer"] },
    ]);
  });

  it("serves a CDN's public bucket read only at /cdn/<cdn id>/ through the edge", () => {
    const nginx = text(stack, "infra/edge/nginx.conf");
    expect(nginx).toContain(
      [
        "    location /cdn/image-delivery/ {",
        `      if ($request_method !~ ^(GET|HEAD)$ ) { return 405 '{"error":"METHOD_NOT_ALLOWED","message":"This route only reads."}'; }`,
        "      set $objects local-objects:3902;",
        "      rewrite ^/cdn/image-delivery/(.*)$ /$1 break;",
        "      proxy_pass http://$objects;",
        "      proxy_set_header Host images.web.garage.localhost;",
      ].join("\n"),
    );
    expect(nginx).toContain("    ~*\\.m3u8$ application/vnd.apple.mpegurl;");
    expect(nginx).toContain("      add_header Content-Type $cdn_type;");
    expect(nginx).toContain(
      `    location @cdn-missing { return 404 '{"error":"NOT_FOUND","message":"No object for this key."}'; }`,
    );
    const plan = json(stack, "infra/local.json");
    expect(plan.objects).toEqual([{ id: "images", public: true }]);
    const services = json(stack, "compose.yaml").services as Services;
    expect(services["app-edge"]?.depends_on).toEqual({
      "app-catalog-api": { condition: "service_healthy" },
      "app-search-api": { condition: "service_healthy" },
      "local-objects": { condition: "service_healthy" },
    });
    expect(processes(stack).delivery).toEqual([
      {
        cdn: "image-delivery",
        name: "Image delivery",
        path: "/cdn/image-delivery/",
        bucket: "images",
        answers:
          "GET and HEAD of the objects in Images, typed by extension; 404 for a missing key, 405 for any other method",
      },
    ]);
    expect(gap(stack, "cdn-image-delivery")).toBeUndefined();
    // Off there is no edge.
    expect(has(off, "infra/edge/nginx.conf")).toBe(false);
  });

  it("serves nothing for a CDN in front of private storage, and says why", () => {
    const design = runStudioCommands(searchStackDesign(), [
      {
        type: "edit",
        element: "images",
        settings: { kind: "object-store", provider: "unspecified", access: "private" },
      },
      on,
    ]);
    const bundle = assemble(design);
    expect(text(bundle, "infra/edge/nginx.conf")).not.toContain("/cdn/");
    expect(gap(bundle, "cdn-image-delivery")).toEqual({
      emitter: "local.foundation",
      id: "cdn-image-delivery",
      required: false,
      status: "custom",
      description:
        "Image delivery serves nothing locally: Images is private. The local edge serves one public object storage a CDN links to at /cdn/<cdn id>/.",
      sourcePaths: [expect.stringMatching(/^\/architecture\/studio\/elements\/\d+$/)],
    });
    expect(processes(bundle).delivery?.[0]).toEqual({
      cdn: "image-delivery",
      name: "Image delivery",
      answers: "nothing locally: Images is private",
    });
    // A non-required custom gap: the stack still runs.
    expect(processes(bundle).runnable).toBe(true);
  });
});

describe("process settings reach the process (v3 contract, section 4, D5)", () => {
  it("runs a stub tile's saved limits: an HTTP process's and a Worker's stub loops", () => {
    let design = runStudioCommands(stubStackDesign(), [on]);
    design = edit(design, "links-api", { requestTimeoutMs: 250, concurrencyLimit: 7 });
    design = edit(design, "visit-worker", { concurrency: 8 });
    const bundle = assemble(design);
    expect(bundle.report.findings).toEqual([]);
    expect(text(bundle, "src/processes/links-api.ts")).toContain(
      '  "settings": {\n    "requestTimeoutMs": 250,\n    "concurrencyLimit": 7\n  },',
    );
    expect(row(bundle, "links-api").settings).toEqual([
      { setting: "requestTimeoutMs", value: 250, origin: "tile" },
      { setting: "concurrencyLimit", value: 7, origin: "tile" },
    ]);
    expect(row(bundle, "visit-worker").settings).toEqual([
      { setting: "concurrency", value: 8, origin: "tile" },
    ]);
    expect(text(bundle, "src/processes/visit-worker.ts")).toContain('"concurrency": 8');
    // A loop stub beside HTTP routes still runs one message at a time.
    expect(text(bundle, "src/processes/links-api.ts")).toContain('"concurrency": 1');
    // Unsaved, each runs its initial value, listed as fixed.
    const fresh = assemble(runStudioCommands(stubStackDesign(), [on]));
    expect(row(fresh, "visit-worker").settings).toEqual([
      { setting: "concurrency", value: 1, origin: "fixed" },
    ]);
    expect(row(fresh, "stats-api").settings).toEqual([
      { setting: "requestTimeoutMs", value: 1000, origin: "fixed" },
      { setting: "concurrencyLimit", value: 1000, origin: "fixed" },
    ]);
    // A template's tile keeps its template as the origin, and its stub loops take its value.
    expect(row(searchStack(), "indexer").settings).toEqual([
      { setting: "concurrency", value: 4, origin: "template", selection: "index-writer" },
    ]);
  });
});
const searchStack = () => assemble(runStudioCommands(searchStackDesign(), [on]));

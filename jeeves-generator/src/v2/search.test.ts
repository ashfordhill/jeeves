import { existsSync, readFileSync } from "node:fs";
import { stripTypeScriptTypes } from "node:module";
import { posix } from "node:path";
import { designSchema } from "@jeeves/spec";
import { describe, expect, it } from "vitest";
import {
  generationSelectionsFixture,
  generationSourceFixture,
} from "../../../jeeves/packages/spec/src/fixtures/yv2-selections.ts";
import {
  publicVideoDocument,
  publicVideoMapping,
} from "../../templates/local-v2/assets/src/features/public-video.ts";
import { defineSearchDocument } from "../../templates/local-v2/assets/src/runtime/search-contract.ts";
import { loadLocalV2Registry } from "../../templates/local-v2/index.ts";
import { assembleV2 } from "./assemble.ts";
import type { V2Emitter } from "./registry.ts";
import { searchProjectionMapping } from "./search.ts";

const urls = new Map<string, string>();
function moduleUrl(name: string): string {
  const cached = urls.get(name);
  if (cached) return cached;
  const base = new URL(`../../templates/local-v2/assets/src/${name}.ts`, import.meta.url);
  const code = stripTypeScriptTypes(
    readFileSync(existsSync(base) ? base : new URL(`${base}.template`), "utf8"),
  )
    .replace(
      /from "(\.\.?\/.+)\.ts"/g,
      (_match, dependency: string) =>
        `from "${moduleUrl(posix.normalize(`${posix.dirname(name)}/${dependency}`))}"`,
    )
    .replace('from "zod"', `from "${import.meta.resolve("zod")}"`);
  const url = `data:text/javascript;base64,${Buffer.from(code).toString("base64")}`;
  urls.set(name, url);
  return url;
}
const { createSearchProjection } = await import(moduleUrl("runtime/search-projection"));
const { assertSearchIndex } = await import(moduleUrl("runtime/search-schema"));
const { createSearchQuery, parseSearchInput } = await import(moduleUrl("runtime/search-query"));
const { startSearchIndexer } = await import(moduleUrl("runtime/search-indexer"));
const { createDeliveryRunner } = await import(moduleUrl("runtime/delivery"));
const { publicVideoQueryPreset } = await import(moduleUrl("features/public-video-search"));

const video = {
  videoId: "a47cc800-ffed-4ec1-9080-9c55f466cf31",
  publicationVersion: 1,
  title: "A public lesson",
  description: "Complete words",
  channel: "Lessons",
  durationSeconds: 3,
  manifest:
    "videos/a47cc800-ffed-4ec1-9080-9c55f466cf31/679acead-ab14-443e-9ec9-97e293f7d454/cf76c96e-dd5e-46f1-8361-28c46b5417a3/master.m3u8",
  thumbnail:
    "videos/a47cc800-ffed-4ec1-9080-9c55f466cf31/679acead-ab14-443e-9ec9-97e293f7d454/cf76c96e-dd5e-46f1-8361-28c46b5417a3/thumbnail.jpg",
  publishedAt: "2026-11-08T12:00:00Z",
  visibility: "public",
  state: "ready",
};
const binding = { index: "public-lessons", ...publicVideoMapping };
describe("emitted search projection/query", () => {
  it("validates public documents, binds ID/version and never decodes normalized events as wire", async () => {
    let decodes = 0;
    const writes: unknown[] = [];
    const projection = createSearchProjection({
      client: {
        async index(request: unknown) {
          writes.push(request);
        },
      },
      binding,
      document: publicVideoDocument,
      adapter: {
        event(raw: unknown) {
          decodes++;
          const wire = raw as { envelope: { document: unknown; id: string } };
          if (!wire.envelope) throw Error("wire only");
          return wire.envelope;
        },
        eventId: (event: { id: string }) => event.id,
        document: (event: { document: unknown }) => event.document,
      },
    });
    const event = projection.parse({ envelope: { id: "publish:1", document: video } }, "publish:1");
    await projection.upsert(event);
    await projection.upsert(event);
    expect(decodes).toBe(1);
    expect(writes).toEqual(
      [0, 1].map(() => ({
        index: "public-lessons",
        id: video.videoId,
        version: 1,
        version_type: "external_gte",
        body: video,
        timeout: "3s",
      })),
    );
    expect(() =>
      projection.parse({ envelope: { id: "publish:1", document: video } }, "other"),
    ).toThrow("Search event mismatch");
    await expect(projection.upsert({ ...event, id: "other" })).rejects.toThrow(
      "Unbound search projection",
    );
    for (const document of [
      { ...video, state: "pending" },
      { ...video, visibility: "private" },
      { ...video, creatorSubject: "secret" },
      { ...video, original: "private/key" },
    ])
      expect(() => publicVideoDocument.parse(document)).toThrow();

    // Same mechanism, unrelated identities/fields; no imported video schema or algorithm copy.
    type Catalog = { sku: string; revision: number; name: string };
    const catalog = defineSearchDocument<Catalog>({
      mapping: {
        version: 2,
        properties: {
          sku: { type: "keyword" },
          revision: { type: "integer" },
          name: { type: "text" },
        },
      },
      codec: {
        parse(input) {
          const d = input as Catalog;
          if (
            typeof d.sku !== "string" ||
            typeof d.name !== "string" ||
            !Number.isSafeInteger(d.revision)
          )
            throw Error("Invalid catalog");
          return d;
        },
      },
      id: (d) => d.sku,
      version: (d) => d.revision,
    });
    const other = createSearchProjection({
      client: {
        async index(request: unknown) {
          writes.push(request);
        },
      },
      binding: { index: "manual-catalog", ...catalog.mapping },
      document: catalog,
      adapter: {
        event: (raw: unknown) => raw as Catalog,
        eventId: (d: Catalog) => `${d.sku}:${d.revision}`,
        document: (d: Catalog) => d,
      },
    });
    await other.upsert(
      other.parse({ sku: "Manual:A", revision: 2, name: "Garden manual" }, "Manual:A:2"),
    );
    expect(writes.at(-1)).toMatchObject({ index: "manual-catalog", id: "Manual:A", version: 2 });
  });
  it("keeps v1 full-word query bounds/preset and refuses partial, unbound or private results", async () => {
    let response = {
      timed_out: false,
      _shards: { failed: 0 },
      hits: { total: { value: 1, relation: "eq" }, hits: [{ _id: video.videoId, _source: video }] },
    };
    let request: unknown;
    const search = createSearchQuery({
      client: {
        async search(value: unknown) {
          request = value;
          return { body: response };
        },
      },
      binding,
      document: publicVideoDocument,
      preset: publicVideoQueryPreset,
    });
    expect(await search({ q: "  public lesson  ", page: "2" })).toMatchObject({
      input: { q: "public lesson", page: 2 },
      pageSize: 20,
      total: 1,
      documents: [video],
    });
    expect(request).toEqual({
      index: "public-lessons",
      body: {
        from: 20,
        size: 20,
        track_total_hits: true,
        timeout: "750ms",
        query: {
          bool: {
            filter: [{ term: { state: "ready" } }, { term: { visibility: "public" } }],
            must: [
              {
                multi_match: {
                  query: "public lesson",
                  fields: ["title^3", "description", "channel^2"],
                  type: "best_fields",
                },
              },
            ],
          },
        },
        sort: [{ _score: "desc" }, { publishedAt: "desc" }, { videoId: "asc" }],
      },
    });
    expect(parseSearchInput({ q: "ok" })).toEqual({ q: "ok", page: 1 });
    for (const raw of [
      { q: " " },
      { q: "x".repeat(201) },
      { q: "ok", page: "101" },
      { q: "ok", page: "01" },
      { q: "ok", page: 2 },
      { q: "ok", query: {} },
    ])
      expect(() => parseSearchInput(raw)).toThrow();
    response = { ...response, timed_out: true };
    await expect(search({ q: "ok" })).rejects.toThrow("Incomplete search result");
    response = {
      ...response,
      timed_out: false,
      hits: { ...response.hits, hits: [{ _id: "wrong", _source: video }] },
    };
    await expect(search({ q: "ok" })).rejects.toThrow("Unbound search document");
    response = {
      ...response,
      hits: {
        ...response.hits,
        hits: [{ _id: video.videoId, _source: { ...video, state: "pending" } }],
      },
    };
    await expect(search({ q: "ok" })).rejects.toThrow();
  });
  it("refuses incompatible existing mappings without repair, drains upsert before ack and leaves service gaps", async () => {
    const actions: string[] = [];
    let properties: unknown = publicVideoMapping.properties;
    const client = {
      indices: {
        async exists() {
          return { body: true };
        },
        async create() {
          actions.push("create");
        },
        async getMapping() {
          return {
            body: {
              [binding.index]: {
                mappings: { dynamic: "strict", _meta: { version: 1 }, properties },
              },
            },
          };
        },
        async getSettings() {
          return {
            body: {
              [binding.index]: {
                settings: { index: { number_of_shards: "1", number_of_replicas: "0" } },
              },
            },
          };
        },
      },
    };
    await assertSearchIndex(client, binding);
    properties = { ...publicVideoMapping.properties, privateKey: { type: "keyword" } };
    await expect(assertSearchIndex(client, binding)).rejects.toThrow(
      "preserve data and migrate explicitly",
    );
    expect(actions).toEqual([]);
    let complete!: () => void, admitted!: () => void;
    const gate = new Promise<void>((resolve) => {
      complete = resolve;
    });
    const started = new Promise<void>((resolve) => {
      admitted = resolve;
    });
    let runner: ReturnType<typeof createDeliveryRunner>;
    const worker = await startSearchIndexer({
      projection: {
        parse: (_raw: unknown, id: string) => {
          if (id !== "ok") throw Error("wire");
          return {};
        },
        async upsert() {
          admitted();
          await gate;
          actions.push("indexed");
        },
      },
      openConsumer: async (handle: unknown) =>
        (runner = createDeliveryRunner({
          queue: "publications",
          failedQueue: "publications.failed",
          retryLimit: 1,
          handle,
          transport: {
            async cancel() {
              actions.push("cancel");
            },
            async close() {
              actions.push("close");
            },
            async republish(_queue: string, _message: unknown, headers: Record<string, unknown>) {
              actions.push(String(headers["x-terminal-code"]));
            },
            ack(receipt: number) {
              actions.push(`ack:${receipt}`);
            },
          },
        })),
    });
    runner.accept({
      body: Buffer.from("{}"),
      messageId: "ok",
      headers: {},
      redelivered: false,
      receipt: 1,
    });
    await started;
    expect(actions).toEqual([]);
    runner.accept({
      body: Buffer.from("{}"),
      messageId: "bad",
      headers: {},
      redelivered: false,
      receipt: 2,
    });
    const closing = worker.close();
    expect(worker.close()).toBe(closing);
    complete();
    await closing;
    expect(actions.indexOf("ack:1")).toBeGreaterThan(actions.indexOf("indexed"));
    expect(actions).toContain("MALFORMED_MESSAGE");
    expect(await worker.closed).toEqual({ fatal: false });

    const generation = generationSelectionsFixture();
    const design = designSchema.parse({
      ...generationSourceFixture(),
      generation: {
        ...generation,
        preset: undefined,
        selections: generation.selections.filter((s) =>
          ["search-projection", "search-query", "youtube-search"].includes(s.binding.kind),
        ),
      },
    });
    const recipe: V2Emitter = {
      id: "probe.search",
      version: "0.1.0",
      status: "diagnostic",
      description: "Compiled explicit mapping",
      sourcePaths: ["jeeves-generator/src/v2/search.ts"],
      render: () => ({ files: [] }),
      local: () =>
        searchProjectionMapping({
          resource: "search-index",
          mapping: publicVideoMapping,
          sourcePaths: ["/generation"],
        }),
    };
    const bundle = assembleV2(
      { designJson: JSON.stringify(design) },
      loadLocalV2Registry([recipe]),
    );
    const plan = JSON.parse(
      new TextDecoder().decode(bundle.files.find((f) => f.path === "infra/local.json")?.bytes),
    );
    expect(plan.search).toEqual([{ resource: "search-index", ...publicVideoMapping }]);
    expect(
      plan.broker.find((b: { resource: string }) => b.resource === "publication-events").queues,
    ).toEqual(["publication-events--search-indexer"]);
    expect(plan.logins).toEqual([]);
    expect(bundle.report.applicationComplete).toBe(false);
    expect(
      bundle.report.gaps.some((g) => g.id === "search-application-bindings" && g.required),
    ).toBe(true);
    expect(loadLocalV2Registry().installed.templates).toEqual([]);
  });
});

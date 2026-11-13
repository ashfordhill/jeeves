import { describe, expect, it } from "vitest";
import { applyOperations } from "./apply.ts";
import {
  designBlueprint,
  designBlueprintJsonSchema,
  designBlueprintSchema,
} from "./studio-blueprint.ts";
import { studioArchitectureExample } from "./studio-examples/index.ts";
import { studioStoreAccess } from "./studio-links.ts";
import { buildStudioCommand, type StudioCommand } from "./studio-operations.ts";
import { validateDesign } from "./validate.ts";

const tinyurl = () => studioArchitectureExample("studio-tinyurl").design;
const marketplace = () => studioArchitectureExample("studio-marketplace").design;
const youtube = () => studioArchitectureExample("studio-youtube").design;

describe("designBlueprint", () => {
  it("exports TinyURL as a schema-valid, deterministic blueprint", () => {
    const design = tinyurl();
    const before = structuredClone(design);
    const blueprint = designBlueprint(design, "TinyURL");
    expect(designBlueprintSchema.parse(blueprint)).toEqual(blueprint);
    expect(design).toEqual(before);
    expect(blueprint).toMatchObject({ blueprint: 2, revision: design.revision, findings: [] });
    expect(blueprint.services.map((s) => s.id)).toEqual([
      "analytics",
      "redirect",
      "shorten",
      "stats-api",
    ]);
    expect(blueprint.services.map((s) => s.components.length)).toEqual([3, 4, 1, 1]);
    expect(blueprint.resources.map((r) => r.id)).toEqual([
      "analytics-store",
      "click-events",
      "url-cache",
      "url-db",
    ]);
    expect(blueprint.externals).toEqual([]);
    expect(blueprint.actions).toEqual([
      { lane: "download", name: "Open link" },
      { lane: "upload", name: "Shorten" },
    ]);
    expect(blueprint.entries).toEqual([
      { lane: "download", action: "Open link", element: "redirect" },
      { lane: "download", action: "Open link", element: "stats-api" },
      { lane: "upload", action: "Shorten", element: "shorten" },
    ]);
    expect(blueprint.connections).toHaveLength(7);
    expect(blueprint.componentLinks).toHaveLength(12);
    expect(blueprint.omitted).toEqual([]);
    // One writer per store: each store's owner writes, every other link into it reads.
    expect(
      Object.fromEntries(blueprint.connections.map((c) => [c.id, c.access ?? c.channelUse])),
    ).toEqual({
      "analytics-write": "write",
      "click-events-analytics": "consume",
      "redirect-cache": "write",
      "redirect-clicks": "publish",
      "redirect-db": "read",
      "shorten-db": "write",
      "stats-read": "read",
    });
    expect(blueprint.connections.every((c) => c.security === "Service identity")).toBe(true);

    const shuffled = tinyurl();
    shuffled.elements.reverse();
    expect(designBlueprint(shuffled, "TinyURL")).toEqual(blueprint);
  });

  it("exports the marketplace study with no findings and one writer per store", () => {
    const design = marketplace();
    expect(validateDesign(design)).toEqual([]);
    const blueprint = designBlueprint(design, "Marketplace");
    expect(designBlueprintSchema.parse(blueprint)).toEqual(blueprint);
    expect(blueprint).toMatchObject({
      blueprint: 2,
      findings: [],
      externals: [{ id: "stripe", name: "Stripe API", category: "payments" }],
      omitted: [],
    });
    expect(blueprint.services.map((s) => [s.id, s.kind, s.components.length])).toEqual([
      ["cart", "service", 1],
      ["identity", "identity", 0],
      ["order-recorder", "worker", 2],
      ["orders", "service", 1],
      ["payments", "service", 6],
      ["search-indexer", "worker", 2],
      ["shop", "service", 3],
      ["storefront", "service", 1],
    ]);
    expect(blueprint.resources.map((r) => [r.id, r.kind])).toEqual([
      ["cart-store", "cache"],
      ["catalog-db", "database"],
      ["image-cdn", "cdn"],
      ["listing-events", "queue"],
      ["order-events", "queue"],
      ["orders-db", "database"],
      ["payments-db", "database"],
      ["product-images", "object-store"],
      ["search-index", "search"],
    ]);
    // Four entries in the upload lane: the cap (`laneLimits.entriesPerLane`) is four.
    expect(blueprint.actions).toEqual([
      { lane: "download", name: "Browse" },
      { lane: "upload", name: "Buy & sell" },
    ]);
    expect(blueprint.entries).toEqual([
      { lane: "download", action: "Browse", element: "image-cdn" },
      { lane: "download", action: "Browse", element: "orders" },
      { lane: "download", action: "Browse", element: "storefront" },
      { lane: "upload", action: "Buy & sell", element: "cart" },
      { lane: "upload", action: "Buy & sell", element: "identity" },
      { lane: "upload", action: "Buy & sell", element: "payments" },
      { lane: "upload", action: "Buy & sell", element: "shop" },
    ]);
    expect(blueprint.componentLinks).toHaveLength(23);
    // Each store's owner is its only writer; queues keep publish and consume.
    expect(
      Object.fromEntries(blueprint.connections.map((c) => [c.id, c.access ?? c.channelUse])),
    ).toEqual({
      "cart-write": "write",
      "cdn-images": "read",
      "indexer-write": "write",
      "listings-indexer": "consume",
      "orders-read": "read",
      "paid-recorder": "consume",
      "payments-paid": "publish",
      "payments-prices": "read",
      "payments-write": "write",
      "recorder-write": "write",
      "shop-catalog": "write",
      "shop-images": "write",
      "shop-listings": "publish",
      "storefront-search": "read",
    });
    // The CDN resizes photos on request; Payments is a Service that calls Stripe.
    expect(blueprint.resources.find((r) => r.id === "image-cdn")?.settings).toEqual({
      kind: "cdn",
      provider: "cloudflare",
      origin: "product-images",
      imageResizing: "on-request",
    });
    expect(blueprint.services.find((s) => s.id === "payments")?.settings).toMatchObject({
      kind: "service",
    });
    expect(blueprint.connections.find((c) => c.id === "payments-stripe")).toMatchObject({
      from: { id: "payments", kind: "service" },
      to: { id: "stripe", kind: "external" },
    });
  });

  it("exports the YouTube study with no findings and one writer per store", () => {
    const design = youtube();
    expect(validateDesign(design)).toEqual([]);
    const blueprint = designBlueprint(design, "YouTube");
    expect(designBlueprintSchema.parse(blueprint)).toEqual(blueprint);
    expect(blueprint).toMatchObject({ blueprint: 2, findings: [], externals: [], omitted: [] });
    expect(blueprint.services.map((s) => [s.id, s.kind, s.components.length])).toEqual([
      ["completion-handler", "worker", 2],
      ["identity", "identity", 0],
      ["search", "service", 1],
      ["search-indexer", "worker", 2],
      ["transcoder", "worker", 5],
      ["upload", "uploads", 3],
      ["view-counter", "worker", 3],
      ["watch", "service", 4],
    ]);
    expect(blueprint.resources.map((r) => [r.id, r.kind])).toEqual([
      ["completion-events", "queue"],
      ["metadata-cache", "cache"],
      ["metadata-db", "database"],
      ["originals", "object-store"],
      ["search-index", "search"],
      ["transcoded", "object-store"],
      ["upload-queue", "queue"],
      ["video-cdn", "cdn"],
      ["view-counts", "database"],
      ["view-events", "queue"],
    ]);
    // A user reaches storage only through a service: the Upload service writes Original videos.
    expect(blueprint.actions).toEqual([
      { lane: "download", name: "Watch" },
      { lane: "upload", name: "Publish" },
    ]);
    expect(blueprint.entries).toEqual([
      { lane: "download", action: "Watch", element: "search" },
      { lane: "download", action: "Watch", element: "video-cdn" },
      { lane: "download", action: "Watch", element: "watch" },
      { lane: "upload", action: "Publish", element: "identity" },
      { lane: "upload", action: "Publish", element: "upload" },
    ]);
    expect(blueprint.componentLinks).toHaveLength(30);
    // Each store's owner is its only writer; queues keep publish and consume. The Watch API owns
    // its cache (it fills it on a miss) and only reads the database the Completion handler writes.
    expect(
      Object.fromEntries(blueprint.connections.map((c) => [c.id, c.access ?? c.channelUse])),
    ).toEqual({
      "cdn-transcoded": "read",
      "completions-handler": "consume",
      "completions-indexer": "consume",
      "counter-write": "write",
      "handler-metadata": "write",
      "indexer-write": "write",
      "jobs-transcoder": "consume",
      "search-read": "read",
      "transcoder-publish": "publish",
      "transcoder-read": "read",
      "transcoder-write": "write",
      "upload-originals": "write",
      "upload-publish": "publish",
      "views-counter": "consume",
      "watch-cache": "write",
      "watch-counts-read": "read",
      "watch-metadata": "read",
      "watch-views-publish": "publish",
    });
    // The Upload service is an Uploads service whose bytes travel by signed URLs.
    expect(blueprint.services.find((s) => s.id === "upload")?.settings).toMatchObject({
      kind: "uploads",
      language: "typescript",
      transfer: "signed-url",
    });
    // The CDN serves the transcoded videos and resizes thumbnails on request.
    expect(blueprint.resources.find((r) => r.id === "video-cdn")?.settings).toEqual({
      kind: "cdn",
      provider: "cloudflare",
      origin: "transcoded",
      imageResizing: "on-request",
    });
  });

  it("derives one writer per store from its owner; changing the owner changes who writes", () => {
    const design = tinyurl();
    expect(studioStoreAccess(design, "shorten-db")).toBe("write");
    expect(studioStoreAccess(design, "redirect-db")).toBe("read");
    expect(studioStoreAccess(design, "stats-read")).toBe("read");
    // Not a store: a queue keeps publish and consume.
    expect(studioStoreAccess(design, "redirect-clicks")).toBeUndefined();
    expect(studioStoreAccess(design, "click-events-analytics")).toBeUndefined();

    const run = (from: typeof design, command: StudioCommand) => {
      const batch = buildStudioCommand(from, command);
      const result = applyOperations(from, batch.ops, { baseRevision: batch.baseRevision });
      if (!result.ok) throw new Error(JSON.stringify(result.errors));
      return result.design;
    };
    const moved = run(design, {
      type: "edit",
      element: "url-db",
      owner: { kind: "element", id: "redirect" },
    });
    expect(studioStoreAccess(moved, "redirect-db")).toBe("write");
    expect(studioStoreAccess(moved, "shorten-db")).toBe("read");
    const access = (from: typeof design) =>
      designBlueprint(from).connections.find((c) => c.id === "shorten-db")?.access;
    expect(access(moved)).toBe("read");

    // No owner: nobody writes.
    const unowned = run(design, { type: "edit", element: "url-db", owner: null });
    expect(access(unowned)).toBe("read");
  });

  it("follows the design revision and publishes a JSON Schema", () => {
    const result = applyOperations(tinyurl(), [
      { op: "updateElement", id: "redirect", name: "Redirector" },
    ]);
    if (!result.ok) throw new Error("rejected");
    const blueprint = designBlueprint(result.design);
    expect(blueprint.revision).toBe(1);
    expect(blueprint.services.find((s) => s.id === "redirect")?.name).toBe("Redirector");
    expect(designBlueprintJsonSchema()).toMatchObject({ type: "object" });
  });
});

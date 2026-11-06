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
    expect(blueprint.entries).toEqual([
      { lane: "download", element: "redirect" },
      { lane: "download", element: "stats-api" },
      { lane: "upload", element: "shorten" },
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
    expect(blueprint).toMatchObject({ blueprint: 2, findings: [], externals: [], omitted: [] });
    expect(blueprint.services.map((s) => [s.id, s.kind, s.components.length])).toEqual([
      ["cart", "service", 1],
      ["identity", "identity", 0],
      ["order-recorder", "worker", 2],
      ["orders", "service", 1],
      ["payments", "billing", 6],
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
    expect(blueprint.entries).toEqual([
      { lane: "download", element: "image-cdn" },
      { lane: "download", element: "orders" },
      { lane: "download", element: "storefront" },
      { lane: "upload", element: "cart" },
      { lane: "upload", element: "identity" },
      { lane: "upload", element: "payments" },
      { lane: "upload", element: "shop" },
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
    // The CDN resizes photos on request; the Payments service is Billing with Stripe.
    expect(blueprint.resources.find((r) => r.id === "image-cdn")?.settings).toEqual({
      kind: "cdn",
      provider: "cloudflare",
      origin: "product-images",
      imageResizing: "on-request",
    });
    expect(blueprint.services.find((s) => s.id === "payments")?.settings).toMatchObject({
      kind: "billing",
      provider: "stripe",
    });
  });

  it("exports the YouTube study with no findings and one writer per store", () => {
    const design = youtube();
    expect(validateDesign(design)).toEqual([]);
    const blueprint = designBlueprint(design, "YouTube");
    expect(designBlueprintSchema.parse(blueprint)).toEqual(blueprint);
    expect(blueprint).toMatchObject({ blueprint: 2, findings: [], externals: [], omitted: [] });
    expect(blueprint.services.map((s) => [s.id, s.kind, s.components.length])).toEqual([
      ["identity", "identity", 0],
      ["processor", "worker", 6],
      ["search", "service", 1],
      ["upload", "service", 3],
      ["view-counter", "worker", 3],
      ["watch", "service", 3],
    ]);
    expect(blueprint.resources.map((r) => [r.id, r.kind])).toEqual([
      ["encoded", "object-store"],
      ["metadata-db", "database"],
      ["originals", "object-store"],
      ["search-index", "search"],
      ["upload-queue", "queue"],
      ["video-cdn", "cdn"],
      ["view-counts", "database"],
      ["view-events", "queue"],
    ]);
    // The user uploads the parts straight into object storage (an entry), with the URLs the
    // Upload service signs.
    expect(blueprint.entries).toEqual([
      { lane: "download", element: "search" },
      { lane: "download", element: "video-cdn" },
      { lane: "download", element: "watch" },
      { lane: "upload", element: "identity" },
      { lane: "upload", element: "originals" },
      { lane: "upload", element: "upload" },
    ]);
    expect(blueprint.componentLinks).toHaveLength(23);
    // Each store's owner is its only writer; queues keep publish and consume.
    expect(
      Object.fromEntries(blueprint.connections.map((c) => [c.id, c.access ?? c.channelUse])),
    ).toEqual({
      "cdn-encoded": "read",
      "counter-write": "write",
      "jobs-processor": "consume",
      "processor-index-write": "write",
      "processor-metadata": "write",
      "processor-read": "read",
      "processor-write": "write",
      "search-read": "read",
      "upload-originals": "write",
      "upload-publish": "publish",
      "views-counter": "consume",
      "watch-counts-read": "read",
      "watch-metadata": "read",
      "watch-views-publish": "publish",
    });
    // The CDN serves the encoded videos and resizes thumbnails on request.
    expect(blueprint.resources.find((r) => r.id === "video-cdn")?.settings).toEqual({
      kind: "cdn",
      provider: "cloudflare",
      origin: "encoded",
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

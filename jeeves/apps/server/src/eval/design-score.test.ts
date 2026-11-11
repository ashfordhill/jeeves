import { type DesignDocument, emptyDesign, type StudioCommand } from "@jeeves/spec";
import { describe, expect, it } from "vitest";
import { V3_VALUES } from "../../../../packages/spec/src/fixtures/v3-modules.ts";
import { installedGenerationSupport } from "../generation/support.ts";
import { buildCase, type ReviewCase, reviewCases, run } from "./design-cases.ts";
import { matchTiles, nameKey, scoreBuild, scoreReview } from "./design-score.ts";
import { goodReview } from "./design-scripts.ts";

const installed = installedGenerationSupport();
const reference = buildCase.reference(installed);
const score = (candidate: DesignDocument, against = reference, values = V3_VALUES) =>
  scoreBuild(against, candidate, installed, values);
const areas = (candidate: DesignDocument, against = reference, values = V3_VALUES) => {
  const result = score(candidate, against, values);
  return {
    total: result.total,
    ...Object.fromEntries(Object.entries(result.areas).map(([key, value]) => [key, value.score])),
  };
};
/** A copy of the reference with a direct edit, as a model's design could differ. */
function changed(change: (draft: DesignDocument) => void, from = reference) {
  const draft = structuredClone(from);
  change(draft);
  return draft;
}
const element = (design: DesignDocument, name: string) => {
  const found = design.elements.find((item) => item.name === name);
  if (!found) throw new Error(name);
  return found;
};
const component = (design: DesignDocument, name: string) => {
  const found = design.architecture?.studio?.components?.find((item) => item.name === name);
  if (!found) throw new Error(name);
  return found;
};

describe("the build score's rules (V3-10)", () => {
  it("scores the reference against itself 100 in every area, and a blank design 0", () => {
    expect(areas(reference)).toEqual({
      total: 100,
      tiles: 100,
      links: 100,
      modules: 100,
      moduleLinks: 100,
      templates: 100,
    });
    expect(areas(emptyDesign())).toEqual({
      total: 0,
      tiles: 0,
      links: 0,
      modules: 0,
      moduleLinks: 0,
      templates: 0,
    });
    // The areas count what the contract counts: 21 tiles, 33 lines, 26 modules, 30 module links,
    // 13 selections and 8 values.
    const { areas: counted } = score(reference);
    expect(
      [counted.tiles, counted.links, counted.modules, counted.moduleLinks, counted.templates].map(
        (item) => item.reference,
      ),
    ).toEqual([21, 33, 26, 30, 13 + 8]);
  });

  it("matches names case-insensitively, punctuation aside, without a trailing kind word", () => {
    expect(nameKey("Metadata database", "database")).toBe("metadata");
    expect(nameKey("Video lifecycle worker", "worker")).toBe("video lifecycle");
    expect(nameKey("Sign-in", "identity")).toBe("sign in");
    // Only the tile's own kind's word, and never the whole name.
    expect(nameKey("Upload jobs queue", "database")).toBe("upload jobs queue");
    expect(nameKey("Cache", "cache")).toBe("cache");
    const renamed = changed((draft) => {
      element(draft, "Metadata").name = "METADATA database";
      element(draft, "Video lifecycle").name = "Video lifecycle worker";
      element(draft, "Hot metadata").name = "hot metadata cache";
      element(draft, "View events").name = "View Events topic";
      element(draft, "Sign-in").name = "sign in";
      component(draft, "Video details cache").name = "video details CACHE";
    });
    expect(areas(renamed).total).toBe(100);
  });

  it("gives half credit to a tile with another name that is the only one of its kind", () => {
    const identity = changed((draft) => {
      element(draft, "Sign-in").name = "Identity";
    });
    const result = score(identity);
    expect(result.tiles["Sign-in"]).toBe("Identity");
    expect(result.areas.tiles.items.find((item) => item.key === "Sign-in")).toEqual({
      key: "Sign-in",
      credit: 0.5,
      note: "another name; the only one of its kind",
    });
    expect(result.areas.tiles.score).toBe(97.6);
    // Its links, modules and templates still count: they follow the matched tile.
    expect(result.areas.links.score).toBe(100);
    expect(result.areas.templates.score).toBe(100);
    // Two databases renamed are not the only ones of their kind: no credit.
    const two = changed((draft) => {
      element(draft, "Metadata").name = "Catalog";
      element(draft, "View counts").name = "Totals";
    });
    expect(score(two).areas.tiles.score).toBe(90.5);
  });

  it("gives half credit to a tile with its name but another kind", () => {
    const small = (kind: "database" | "cache") =>
      run(emptyDesign(), [
        { type: "addAction", lane: "download", name: "Watch", system: { name: "Small" } },
        {
          type: "addTile",
          from: { lane: "download" },
          side: "after",
          tile: { id: "watch-api", name: "Watch API", kind: "service" },
          linkId: "download-watch-api",
        },
        {
          type: "addTile",
          from: { tile: "watch-api" },
          side: "after",
          tile: { id: "metadata", name: "Metadata", kind },
          linkId: "watch-api-metadata",
        },
      ]);
    const result = score(small("cache"), small("database"), []);
    expect(result.areas.tiles.items).toEqual([
      { key: "Watch API", credit: 1 },
      { key: "Metadata", credit: 0.5, note: "kind cache, not database" },
    ]);
    expect(result.areas.tiles.score).toBe(75);
    expect(result.areas.links.score).toBe(100);
  });

  it("costs an extra tile or line as much as a missing one", () => {
    const tile = (
      from: Extract<StudioCommand, { type: "addTile" }>["from"],
      name: string,
    ): StudioCommand => ({
      type: "addTile",
      from,
      side: "after",
      tile: { id: name.toLowerCase(), name, kind: "service" },
      linkId: `${"lane" in from ? from.lane : from.tile}-${name.toLowerCase()}`,
    });
    // Watch has 4 entries, its most, and Publish 2 of its 4.
    const grown = run(reference, [
      tile({ lane: "upload" }, "Recommendations"),
      tile({ lane: "upload" }, "History"),
      tile({ tile: "search-api" }, "Comments"),
    ]);
    const result = score(grown);
    expect(result.areas.tiles.score).toBe(87.5);
    expect(result.areas.links.score).toBe(91.7);
    expect(result.areas.modules.score).toBe(100);
  });

  it("gives half credit to a line of the other style, and none to a missing one", () => {
    const solid = changed((draft) => {
      const link = draft.connections.find((item) => item.id === "watch-api-view-events");
      if (!link) throw new Error("Watch API publishes View events");
      link.planned.interaction = "Request / response";
    });
    const result = score(solid);
    expect(result.areas.links.items.find((item) => item.key === "Watch API → View events")).toEqual(
      {
        key: "Watch API → View events",
        credit: 0.5,
        note: "solid, not dashed",
      },
    );
    expect(result.areas.links.score).toBe(98.5);
  });

  it("gives half credit to a module of another kind, or another name when it is the only one of its kind", () => {
    const result = score(
      changed((draft) => {
        component(draft, "View publisher").settings = {
          kind: "event-publisher",
          outbox: "disabled",
        };
        component(draft, "Count writer").name = "Totals writer";
      }),
    );
    const item = (key: string) => result.areas.modules.items.find((row) => row.key === key);
    expect(item("Watch API / View publisher")).toEqual({
      key: "Watch API / View publisher",
      credit: 0.5,
      note: "kind event-publisher, not custom",
    });
    expect(item("View counter / Count writer")).toEqual({
      key: "View counter / Count writer",
      credit: 0.5,
      note: "another name; the only one of its kind",
    });
    expect(result.areas.modules.score).toBe(96.2);
  });

  it("scores each template where it resolves and each useful value as set", () => {
    const result = score(
      changed((draft) => {
        const row = draft.architecture?.studio?.elements.find(
          (item) => item.element === "hot-metadata",
        );
        if (row?.settings.kind !== "cache") throw new Error("Hot metadata is a cache");
        row.settings.ttlSeconds = 3600;
      }),
    );
    expect(result.areas.templates.items.filter((item) => item.credit < 1)).toEqual([
      { key: "Hot metadata.ttlSeconds = 3601", credit: 0, note: "is 3600" },
    ]);
    expect(result.areas.templates.score).toBe(95.2);
    // Favorites behind an Optional guard is a stub: its template is not resolved.
    const optional = run(reference, [
      {
        type: "editComponent",
        component: "account-api-account-check",
        settings: { kind: "auth-guard", credential: "jwt", signIn: "optional" },
      },
    ]);
    const stub = score(optional).areas.templates.items.filter((item) => item.credit < 1);
    expect(stub.map((item) => item.key)).toEqual(
      expect.arrayContaining(["favorites in Account API"]),
    );
  });

  it("matches tiles by name before kind, so a reused name is never a second match", () => {
    const tiles = matchTiles(
      reference,
      changed((draft) => {
        element(draft, "View counts").name = "Metadata";
      }),
    );
    // Metadata takes its namesake; View counts is left with no database of its own name.
    expect(tiles.get("metadata")).toEqual({ id: "metadata", credit: 1 });
    expect(tiles.get("view-counts")?.credit ?? 0).toBeLessThan(1);
  });
});

describe("the review score's rules (V3-10)", () => {
  const test = (id: string): ReviewCase => {
    const found = reviewCases.find((item) => item.id === id);
    if (!found) throw new Error(id);
    return found;
  };
  const after = (item: ReviewCase) => run(item.seed(), goodReview(item).commands);

  it("gives full marks for naming where and what, and fixing it with nothing else to fix", () => {
    for (const item of reviewCases) {
      const result = scoreReview(item, item.seed(), after(item), goodReview(item).reply, installed);
      expect({ id: item.id, ...result, before: undefined, after: undefined }).toMatchObject({
        id: item.id,
        score: 100,
        named: 1,
        fixed: 1,
        notes: [],
      });
    }
  });

  it("gives nothing for silence and an unchanged design, except the advice's right change: none", () => {
    for (const item of reviewCases) {
      const result = scoreReview(item, item.seed(), item.seed(), "Looks fine.", installed);
      expect([item.id, result.named, result.fixed]).toEqual([
        item.id,
        0,
        item.expect === "keep" ? 1 : 0,
      ]);
    }
  });

  it("gives half for naming where without what, and for a fix that loses a seed tile", () => {
    const store = test("review-store-without-writer");
    const named = scoreReview(store, store.seed(), store.seed(), "Records looks odd.", installed);
    expect([named.named, named.notes]).toEqual([0.5, ["named where, not what", "still reported"]]);
    const removed = run(store.seed(), [{ type: "removeTile", tile: "records" }]);
    const lost = scoreReview(store, store.seed(), removed, "Records had no writer.", installed);
    expect([lost.fixed, lost.score, lost.notes]).toEqual([0.5, 75, ["tiles lost: records"]]);
  });

  it("gives no fix credit for advice answered with a new tile", () => {
    const long = test("review-long-line");
    const grown = run(long.seed(), [
      {
        type: "addTile",
        from: { tile: "upload-api" },
        side: "after",
        tile: { id: "metadata-proxy", name: "Metadata proxy", kind: "service" },
        linkId: "upload-api-metadata-proxy",
      },
    ]);
    const result = scoreReview(
      long,
      long.seed(),
      grown,
      "Upload API's long line to Metadata is fixed.",
      installed,
    );
    expect([result.named, result.fixed]).toEqual([1, 0]);
    expect(result.notes).toContain("tiles added: metadata proxy");
  });
});

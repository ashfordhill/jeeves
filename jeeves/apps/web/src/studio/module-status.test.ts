// The words for what a module generates: a kind's place in a tile's module fan, and a module's
// status line on its page.
import { type ModuleStatus, studioComponentKinds } from "@jeeves/spec";
import { describe, expect, it } from "vitest";
import { moduleGeneration, moduleStatusLine } from "./module-status.ts";

describe("moduleGeneration", () => {
  it("names a lead or part only where its template allows the tile, else a stub", () => {
    const by = (host: "service" | "worker" | "uploads") =>
      Object.fromEntries(studioComponentKinds.map((kind) => [kind, moduleGeneration(kind, host)]));
    // A Cache reader leads a template in a service, but a Worker's is a stub.
    expect(by("service")["cache-reader"]).toBe("lead");
    expect(by("worker")["cache-reader"]).toBe("stub");
    // The Worker leads the lifecycle, encoding, counting and indexing templates.
    expect(studioComponentKinds.filter((kind) => by("worker")[kind] === "lead")).toEqual([
      "lifecycle-writer",
      "video-encoder",
      "event-counter",
      "index-writer",
    ]);
    // An Event consumer is part only of worker templates; an Auth guard leads the sign-in in a
    // Service or Uploads tile (V3-06) and is a stub in a Worker.
    expect([by("service")["event-consumer"], by("worker")["event-consumer"]]).toEqual([
      "stub",
      "part",
    ]);
    expect([
      by("service")["auth-guard"],
      by("uploads")["auth-guard"],
      by("worker")["auth-guard"],
    ]).toEqual(["lead", "lead", "stub"]);
    // Stub kinds are stubs everywhere.
    expect(by("service").custom).toBe("stub");
  });
});

describe("moduleStatusLine", () => {
  const base: ModuleStatus = {
    module: "watch-cache",
    name: "Details cache",
    host: "watch",
    kind: "cache-reader",
    status: "template",
    unconnected: [],
  };
  it("gives the template's name, or the reason", () => {
    expect(moduleStatusLine({ ...base, template: "positive-cache-read" })).toEqual({
      label: "Template",
      detail: "Cache read",
    });
    expect(moduleStatusLine({ ...base, status: "stub", reason: "Needs a cache." })).toEqual({
      label: "Stub",
      detail: "Needs a cache.",
    });
    expect(
      moduleStatusLine({
        ...base,
        status: "refused",
        template: "positive-cache-read",
        reason:
          "The link from Watch API to Metadata database uses Service identity, which its template can't use.",
      }),
    ).toEqual({
      label: "Refused",
      detail:
        "The link from Watch API to Metadata database uses Service identity, which its template can't use.",
    });
    expect(moduleStatusLine({ ...base, status: "custom" })).toEqual({ label: "Custom" });
  });
});

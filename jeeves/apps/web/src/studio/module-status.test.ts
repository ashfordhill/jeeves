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
    // An Event consumer is part only of worker templates; an Auth guard only of the upload one.
    expect([by("service")["event-consumer"], by("worker")["event-consumer"]]).toEqual([
      "stub",
      "part",
    ]);
    expect([by("uploads")["auth-guard"], by("worker")["auth-guard"]]).toEqual(["part", "stub"]);
    // Stub kinds are stubs everywhere.
    expect(by("service").custom).toBe("stub");
  });
});

describe("moduleStatusLine", () => {
  const base: ModuleStatus = {
    module: "watch-cache",
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
          "Local preset supports Private network; declared Service identity remains unsupported and is preserved.",
      }),
    ).toEqual({
      label: "Refused",
      detail:
        "Local preset supports Private network; declared Service identity remains unsupported and is preserved.",
    });
    expect(moduleStatusLine({ ...base, status: "custom" })).toEqual({ label: "Custom" });
  });
});

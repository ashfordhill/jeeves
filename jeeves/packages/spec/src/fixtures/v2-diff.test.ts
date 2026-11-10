import { describe, expect, it } from "vitest";
import { v2Diff, v2DiffReport } from "./v2-diff.ts";
import { frozenV2Design, v2ModuleDesign } from "./v2-modules.ts";

const keys = (rows: readonly { area: string; key: string }[]) =>
  rows.map((row) => `${row.area}: ${row.key}`);

describe("the v2 rebuild diff", () => {
  it("finds nothing between the frozen v2 and itself", () => {
    expect(v2Diff(frozenV2Design(), frozenV2Design())).toEqual([]);
  });

  it("finds only the useful values the command-built twin leaves at their initial values", () => {
    const report = v2DiffReport(v2Diff(frozenV2Design(), v2ModuleDesign()));
    expect(keys(report.unexpected)).toEqual([
      "tile setting: Metadata cache.ttlSeconds",
      "tile setting: Upload API.concurrencyLimit",
      "tile setting: Upload API.requestTimeoutMs",
      "tile setting: View counter.concurrency",
      "tile setting: Watch API.concurrencyLimit",
      "module setting: Video details reader.poolSize",
      "module setting: Video details reader.statementTimeoutMs",
      "selection input: event-counter in View counter.host.concurrency",
      "selection input: owned-multipart in Upload API.host.concurrencyLimit",
      "selection input: owned-multipart in Upload API.host.requestTimeoutMs",
      "selection input: positive-cache-read in Watch API.cache.ttlSeconds",
      "selection input: positive-cache-read in Watch API.host.concurrencyLimit",
      "selection input: positive-cache-read in Watch API.source.poolSize",
      "selection input: positive-cache-read in Watch API.source.statementTimeoutMs",
    ]);
    // The twin keeps v2's module names; every other intended difference is there.
    expect(report.unused.map((rule) => rule.area)).toEqual(["module name"]);
  });

  it("reports a changed interaction, module kind or module link as unexpected", () => {
    const twin = v2ModuleDesign();
    const link = twin.connections.find((item) => item.id === "watch-cache");
    const studio = twin.architecture?.studio;
    const reader = studio?.components?.find((item) => item.id === "watch-counts");
    if (!link || !studio || !reader) throw new Error("The twin has v2's IDs");
    link.planned.interaction = "Asynchronous";
    reader.settings = { kind: "custom" };
    studio.componentConnections = studio.componentConnections?.filter(
      (item) => item.from !== "watch-views",
    );
    const unexpected = keys(v2DiffReport(v2Diff(frozenV2Design(), twin)).unexpected);
    expect(unexpected).toEqual(
      expect.arrayContaining([
        "link: Watch API → Metadata cache",
        "module kind: Watch API / View count reader",
        "module link: View publisher → View events",
      ]),
    );
  });
});

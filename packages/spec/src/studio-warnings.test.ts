import { describe, expect, it } from "vitest";
import { applyOperations } from "./apply.ts";
import { type DesignDocument, emptyDesign } from "./design.ts";
import { isDesignWarning, isStructural } from "./findings.ts";
import { studioArchitectureExample, studioArchitectureExamples } from "./studio-examples/index.ts";
import { laneOptions } from "./studio-lane-commands.ts";
import { laneActionNode, laneFindings } from "./studio-lanes.ts";
import { buildStudioCommand, type StudioCommand } from "./studio-operations.ts";
import { validateStudio } from "./studio-validation.ts";
import {
  studioWarningRules,
  studioWarningSentence,
  studioWarningSummaries,
  studioWarnings,
} from "./studio-warnings.ts";
import { validateDesign } from "./validate.ts";

const tinyurl = (): DesignDocument => studioArchitectureExample("studio-tinyurl").design;
/** Builds the command and applies it: a warning never refuses an edit. */
function run(design: DesignDocument, command: StudioCommand) {
  const batch = buildStudioCommand(design, command);
  const result = applyOperations(design, batch.ops, { baseRevision: batch.baseRevision });
  if (!result.ok) throw new Error(JSON.stringify(result.errors));
  expect(laneFindings(result.design)).toEqual([]);
  return result.design;
}
const warnings = (design: DesignDocument) =>
  studioWarnings(design).map(({ rule, node, message }) => ({ rule, node, message }));

describe("design warnings", () => {
  it("the three studies have none", () => {
    for (const study of studioArchitectureExamples) {
      const design = studioArchitectureExample(study.id).design;
      expect(studioWarnings(design)).toEqual([]);
      expect(validateDesign(design)).toEqual([]);
    }
  });

  it("a store with no writer: Add before the URL database, or remove the owner's link (DP10)", () => {
    const expected = [
      {
        rule: "store-without-writer",
        node: "url-db",
        message:
          "URL database has no writer: its owner Shorten service doesn't link to it. Link Shorten service to it, or choose another owner.",
      },
    ];
    const before = run(tinyurl(), {
      type: "addTile",
      from: { tile: "url-db" },
      side: "before",
      tile: { id: "link-store", name: "Link store", kind: "service" },
      linkId: "store-db",
    });
    expect(warnings(before)).toEqual(expected);
    const unlinked = run(tinyurl(), { type: "removeLink", link: "shorten-db" });
    expect(warnings(unlinked)).toEqual(expected);
    // It is a finding, never a structural error, so the next edit is still accepted.
    const finding = validateStudio(unlinked).find((item) => item.code === "DESIGN_WARNING");
    expect(finding).toMatchObject({
      severity: "warning",
      message: expected[0]?.message,
      target: { element: "url-db" },
    });
    expect(finding && isStructural(finding)).toBe(false);
    // Linking the owner back clears it.
    const relinked = run(unlinked, {
      type: "linkTiles",
      from: { tile: "shorten" },
      to: "url-db",
      linkId: "shorten-db",
    });
    expect(warnings(relinked)).toEqual([]);
  });

  it("a store with no owner has no writer", () => {
    const design = tinyurl();
    const binding = design.architecture?.studio?.elements.find((item) => item.element === "url-db");
    if (binding) delete binding.owner;
    expect(warnings(design)).toEqual([
      {
        rule: "store-without-writer",
        node: "url-db",
        message:
          "URL database has no writer: it has no owner. Choose its owner, the tile that writes it.",
      },
    ]);
  });

  it("a worker's output nobody reads, but not a store its service owner alone uses or a cache", () => {
    const unread = run(tinyurl(), { type: "removeLink", link: "stats-read" });
    expect(warnings(unread)).toEqual([
      {
        rule: "output-unread",
        node: "analytics-store",
        message:
          "Nothing reads Analytics store: only its owner Analytics worker links to it. Link the service or API that reads it.",
      },
    ]);
    // A cache the worker alone uses is normal.
    const cached = run(tinyurl(), {
      type: "addTile",
      from: { tile: "analytics" },
      side: "after",
      tile: { id: "rollup-cache", name: "Rollup cache", kind: "cache" },
      linkId: "analytics-rollup",
    });
    expect(warnings(cached)).toEqual([]);
    // So is a database only its service owner links to.
    const owned = run(tinyurl(), {
      type: "addTile",
      from: { tile: "shorten" },
      side: "after",
      tile: { id: "audit-db", name: "Audit log", kind: "database" },
      linkId: "shorten-audit",
    });
    expect(warnings(owned)).toEqual([]);
  });

  it("a queue with no consumer while it is being built, and one with no publisher", () => {
    const queued = run(tinyurl(), {
      type: "addTile",
      from: { tile: "shorten" },
      side: "after",
      tile: { id: "link-events", name: "Link events", kind: "queue" },
      linkId: "shorten-events",
    });
    expect(warnings(queued)).toEqual([
      {
        rule: "queue-without-consumer",
        node: "link-events",
        message: "Link events has no consumer: nothing takes its messages. Add a worker after it.",
      },
    ]);
    // Not a lane error: the lane commands still offer the worker after the queue.
    expect(
      laneOptions(queued, { tile: "link-events" }, "after").find((item) => item.type === "service"),
    ).toEqual({ type: "service", kind: "worker" });
    const consumed = run(queued, {
      type: "addTile",
      from: { tile: "link-events" },
      side: "after",
      tile: { id: "indexer", name: "Indexer", kind: "worker" },
      linkId: "events-indexer",
    });
    expect(warnings(consumed)).toEqual([]);

    // With its publisher's link gone (stored that way), Click events has no publisher.
    const design = tinyurl();
    design.connections = design.connections.filter((item) => item.id !== "redirect-clicks");
    expect(warnings(design)).toContainEqual({
      rule: "queue-without-publisher",
      node: "click-events",
      message:
        "Click events has no publisher: nothing sends it messages. Link the service that publishes them to it.",
    });
    expect(warnings(tinyurl())).toEqual([]);
  });

  it("an action with no entries, until something handles it", () => {
    const watch = run(emptyDesign(), {
      type: "addAction",
      lane: "download",
      name: "Watch",
      system: { name: "Videos" },
    });
    expect(warnings(watch)).toEqual([
      {
        rule: "action-without-entries",
        node: laneActionNode("download"),
        message:
          "Watch has no entries: nothing handles it yet. Add the service or API that handles it after it, or remove the action.",
      },
    ]);
    const finding = validateDesign(watch).find(isDesignWarning);
    expect(finding?.target).toEqual({ path: ["architecture", "studio", "actions", 0] });
    const handled = run(watch, {
      type: "addTile",
      from: { lane: "download" },
      side: "after",
      tile: { id: "api", name: "Video API", kind: "gateway" },
      linkId: "download-api",
    });
    expect(warnings(handled)).toEqual([]);
  });

  it("the chat sentence is generated from the warning list", () => {
    for (const rule of studioWarningRules)
      expect(studioWarningSentence).toContain(studioWarningSummaries[rule]);
  });
});

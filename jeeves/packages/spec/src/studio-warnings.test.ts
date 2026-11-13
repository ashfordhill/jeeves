import { describe, expect, it } from "vitest";
import { applyOperations } from "./apply.ts";
import { type DesignDocument, emptyDesign } from "./design.ts";
import { isDesignWarning, isStructural } from "./findings.ts";
import { studioArchitectureExample, studioArchitectureExamples } from "./studio-examples/index.ts";
import { linkFanOptions } from "./studio-lane-commands.ts";
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
  it("studies have no topology warnings; the foundation retains its honest verifier gaps", () => {
    const ids: string[] = [
      ...studioArchitectureExamples.map((study) => study.id),
      "studio-tinyurl-foundation",
    ];
    for (const id of ids) {
      const design = studioArchitectureExample(id).design;
      expect(studioWarnings(design)).toEqual([]);
      expect(validateDesign(design).filter(isStructural)).toEqual([]);
      if (id !== "studio-tinyurl-foundation") expect(validateDesign(design)).toEqual([]);
      else
        expect(validateDesign(design).every((x) => x.message.includes("auth verifier"))).toBe(true);
    }
  });

  it("a store with no writer: remove the owner's link (DP10)", () => {
    const expected = [
      {
        rule: "store-without-writer",
        node: "url-db",
        message:
          "URL database has no writer: its owner Shorten service doesn't link to it. Link Shorten service to it, or choose another owner.",
      },
    ];
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
    // Not a lane error: the link fan still offers the worker after the queue.
    expect(
      linkFanOptions(queued, { tile: "link-events" }).find((o) => o.kind === "worker"),
    ).toEqual({ kind: "worker", group: "application" });
    const consumed = run(queued, {
      type: "addTile",
      from: { tile: "link-events" },
      side: "after",
      tile: { id: "indexer", name: "Indexer", kind: "worker" },
      linkId: "events-indexer",
    });
    expect(warnings(consumed)).toEqual([
      expect.objectContaining({ rule: "worker-without-output", node: "indexer" }),
    ]);
    // An outgoing publication counts as represented output; no payload semantics are guessed.
    const published = run(consumed, {
      type: "addTile",
      from: { tile: "indexer" },
      side: "after",
      tile: { id: "indexed", name: "Indexed", kind: "queue" },
      linkId: "indexer-indexed",
    });
    expect(warnings(published).map((item) => item.rule)).toEqual(["queue-without-consumer"]);

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

  it("warns about upload storage without inferring lifecycle state from labels", () => {
    const upload = run(emptyDesign(), {
      type: "addTile",
      from: { lane: "upload" },
      side: "after",
      system: { name: "Media" },
      tile: { id: "uploads", name: "Ready with durable retry", kind: "uploads" },
      linkId: "upload-uploads",
    });
    expect(warnings(upload)).toEqual([
      expect.objectContaining({ rule: "uploads-without-storage", node: "uploads" }),
    ]);
    const stored = run(upload, {
      type: "addTile",
      from: { tile: "uploads" },
      side: "after",
      tile: { id: "originals", name: "Originals", kind: "object-store" },
      linkId: "uploads-originals",
    });
    expect(warnings(stored)).toEqual([]);
  });

  it("the chat sentence is generated from the warning list", () => {
    for (const rule of studioWarningRules)
      expect(studioWarningSentence).toContain(studioWarningSummaries[rule]);
  });
});

describe("declared store writers", () => {
  const foundation = () => {
    const design = studioArchitectureExample("studio-tinyurl-foundation").design;
    if (design.schemaVersion !== 3 || !design.ownership) throw new Error();
    return design as typeof design & { ownership: NonNullable<typeof design.ownership> };
  };
  it("uses valid authority/role/grant/dependency facts without fabricating legacy owner metadata", () => {
    const design = foundation(),
      before = structuredClone(design);
    expect(studioWarnings(design)).toEqual([]);
    expect(design).toEqual(before);
    // Canonical ownership allows API or worker role intent for any application kind.
    const role = design.ownership.roles[0];
    if (role) role.kind = "worker";
    expect(studioWarnings(design)).toEqual([]);
  });
  it.each(["grant", "dependency", "authority", "role", "read-only", "foreign", "duplicate"])(
    "does not infer a declared write from missing/invalid %s, even with a legacy writer",
    (mode) => {
      const design = foundation(),
        model = design.ownership;
      const binding = design.architecture?.studio?.elements.find((x) => x.element === "links-db");
      if (binding) binding.owner = { kind: "element", id: "create-api" };
      if (mode === "grant") model.grants = model.grants.filter((x) => x.role !== "create-api");
      if (mode === "dependency")
        model.dependencies = model.dependencies.filter((x) => x.connection !== "create-store");
      if (mode === "authority")
        model.resources = model.resources.filter((x) => x.element !== "links-db");
      if (mode === "role") model.roles = model.roles.filter((x) => x.element !== "create-api");
      if (mode === "read-only") {
        const grant = model.grants.find((x) => x.role === "create-api"),
          dep = model.dependencies.find((x) => x.connection === "create-store");
        if (grant) grant.access = "read";
        if (dep) dep.access = "read";
      }
      if (mode === "foreign") {
        const role = model.roles.find((x) => x.element === "create-api");
        if (role) role.owner = "another-owner";
      }
      if (mode === "duplicate" && model.grants[0]) model.grants.push({ ...model.grants[0] });
      expect(studioWarnings(design)).toContainEqual(
        expect.objectContaining({
          rule: "store-without-writer",
          node: "links-db",
          message: expect.stringContaining("no declared writer"),
        }),
      );
    },
  );
  it("names the declared worker writer for an unread source instead of an absent legacy owner", () => {
    const design = foundation();
    const binding = design.architecture?.studio?.elements.find((x) => x.element === "create-api");
    if (binding) binding.settings = { kind: "worker", execution: "docker", language: "typescript" };
    design.connections = design.connections.filter((x) => x.id !== "resolve-store");
    expect(studioWarnings(design)).toContainEqual({
      rule: "output-unread",
      node: "links-db",
      message:
        "Nothing reads Links database: only its declared writer Create link links to it. Link the service or API that reads it.",
    });
  });
});

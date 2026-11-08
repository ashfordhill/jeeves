import { describe, expect, it } from "vitest";
import { applyOperations } from "./apply.ts";
import { emptyDesign } from "./design.ts";
import { laneFindings } from "./studio-lanes.ts";
import { buildStudioCommand } from "./studio-operations.ts";
import { studioPatternIds, studioPatterns } from "./studio-patterns.ts";

describe("reviewed design pattern examples", () => {
  it.each(studioPatternIds)("%s uses the real command vocabulary without hiding its gaps", (id) => {
    const pattern = studioPatterns[id];
    expect(new Set(pattern.support.obligations.map((item) => item.id)).size).toBe(
      pattern.support.obligations.length,
    );
    expect(new Set(pattern.checklist.map((item) => item.id)).size).toBe(pattern.checklist.length);
    const roles = new Set(pattern.roles.map((role) => role.id));
    for (const relationship of pattern.relationships) {
      expect(roles.has(relationship.from)).toBe(true);
      expect(roles.has(relationship.to)).toBe(true);
    }
    if (pattern.example.kind === "obligation") {
      expect(pattern.support.topology).toBe("partial");
      expect(pattern.example.sequence.length).toBeGreaterThan(0);
      return;
    }
    let design = emptyDesign();
    for (const command of pattern.example.commands) {
      const batch = buildStudioCommand(design, command);
      const result = applyOperations(design, batch.ops, { baseRevision: batch.baseRevision });
      if (!result.ok) throw new Error(JSON.stringify({ id, command, errors: result.errors }));
      design = result.design;
    }
    expect(design.elements.length).toBeGreaterThan(0);
    expect(laneFindings(design)).toEqual([]);
    if (id === "durable-background-job") {
      expect(
        design.connections.find((connection) => connection.id === "processor-originals"),
      ).toMatchObject({ planned: { label: "Reads originals", interaction: "Request / response" } });
      expect(
        design.architecture?.studio?.elements.find((item) => item.element === "originals")?.owner,
      ).toEqual({ kind: "element", id: "video" });
      // The same owner must receive the result; the example does not pretend a second owner fixes it.
      expect(
        design.elements.filter((item) => ["video", "processor"].includes(item.id)),
      ).toHaveLength(2);
      expect(design.elements).toHaveLength(6);
    }
  });
});

// The module menu's groups: every module kind in exactly one, in catalog order within it.
import { studioComponentKinds } from "@jeeves/spec";
import { describe, expect, it } from "vitest";
import { moduleGroupOf, moduleGroups } from "./module-groups.ts";

describe("moduleGroups", () => {
  it("puts every module kind in exactly one group", () => {
    for (const kind of studioComponentKinds)
      expect(
        moduleGroups.filter((group) => group.kinds.includes(kind)),
        kind,
      ).toHaveLength(1);
    expect(moduleGroups.flatMap((group) => group.kinds)).toHaveLength(studioComponentKinds.length);
  });

  it("orders the groups by what they do, each with its family, its kinds in catalog order", () => {
    expect(moduleGroups.map((group) => [group.label, group.family])).toEqual([
      ["Requests", "api"],
      ["Data", "data"],
      ["Events", "messaging"],
      ["Files & media", "worker"],
      ["Custom", "generic"],
    ]);
    for (const group of moduleGroups)
      expect(group.kinds).toEqual(
        studioComponentKinds.filter((kind) => group.kinds.includes(kind)),
      );
    expect(moduleGroups[0]?.kinds).toEqual([
      "rate-limiter",
      "redirect-responder",
      "auth-guard",
      "external-call",
    ]);
    expect(moduleGroupOf("favorites").label).toBe("Data");
    expect(moduleGroupOf("video-encoder").family).toBe("worker");
  });
});

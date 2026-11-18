import { buildSupportedAuthoringCommand } from "@jeeves/spec";
import { expect, test } from "vitest";
import { foundationsDesign } from "../../../field-projects/generator-system/fixtures/rg-foundations/design.ts";
import { runStudioCommands } from "../../../jeeves/packages/spec/src/fixtures/v2-modules.ts";
import { loadLocalV2Registry } from "../../templates/local-v2/index.ts";
import { assembleV2 } from "./assemble.ts";

test("RG14: an internal HTTP reader refuses the missing workload adapter; the authenticated in-process composition remains runnable", () => {
  const registry = loadLocalV2Registry();
  const source = foundationsDesign();
  const valid = assembleV2({ designJson: JSON.stringify(source) }, registry);
  expect(valid.report.findings).toEqual([]);
  expect(valid.report.processes?.runnable).toBe(true);
  const command = {
    type: "editComponent" as const,
    component: "record-reader",
    settings: {
      kind: "cache-reader" as const,
      pattern: "cache-aside" as const,
      stampede: "single-flight" as const,
      freshness: "versioned" as const,
      transport: "http" as const,
    },
  };
  // RG22 rejects new unsupported combinations at normal authoring; imported source remains
  // readable through diagnostic assembly and is refused by the actual export boundaries.
  expect(() => buildSupportedAuthoringCommand(source, command, registry.installed)).toThrow(
    "internal service has no workload-authenticated template adapter",
  );
  const invalid = runStudioCommands(source, [
    {
      type: "editComponent",
      component: "record-reader",
      settings: {
        kind: "cache-reader",
        pattern: "cache-aside",
        stampede: "single-flight",
        freshness: "versioned",
        transport: "http",
      },
    },
  ]);
  const refused = assembleV2({ designJson: JSON.stringify(invalid) }, registry);
  expect(refused.report.findings).toContainEqual(
    expect.objectContaining({
      code: "NEEDS_TEMPLATE",
      message: expect.stringContaining(
        "internal service has no workload-authenticated template adapter",
      ),
    }),
  );
  expect(refused.report.processes?.runnable).toBe(false);
});

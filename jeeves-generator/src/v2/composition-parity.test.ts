import {
  applyOperations,
  buildSupportedAuthoringCommand,
  designGeneration,
  generationExportBlockers,
  normalGenerationControls,
  resolveGeneration,
} from "@jeeves/spec";
import { expect, it } from "vitest";
import { foundationsDesign } from "../../../field-projects/generator-system/fixtures/rg-foundations/design.ts";
import { receiptDesign } from "../../../field-projects/generator-system/fixtures/rg-receipts/design.ts";
import { scheduledDesign } from "../../../field-projects/generator-system/fixtures/rg-scheduled/design.ts";
import { sessionForwardingDesign } from "../../../field-projects/generator-system/fixtures/rg-session-forwarding/design.ts";
import { webhookDesign } from "../../../field-projects/generator-system/fixtures/rg-webhook/design.ts";
import { loadLocalV2Registry } from "../../templates/local-v2/index.ts";
import { assembleV2 } from "./assemble.ts";

const registry = loadLocalV2Registry();

it("RG25 emitted migration commands acknowledge the actual target extension API", () => {
  const bundle = assembleV2({ designJson: JSON.stringify(foundationsDesign()) }, registry);
  const file = bundle.files.find((item) => item.path === ".jeeves/extensions.md");
  expect(file).toBeDefined();
  const versions = [
    ...new TextDecoder().decode(file?.bytes).matchAll(/--ack-extension-api=(\d+)/g),
  ].map((match) => Number(match[1]));
  expect(versions.length).toBeGreaterThan(2);
  // The updater accepts the emitted target version, including SQL-baseline migrations.
  expect(new Set(versions)).toEqual(new Set([bundle.manifest.extensionApi.version]));
});

it("RG22 raw selections refuse shared cache eviction requirements and callable effect mismatches", () => {
  const raw = foundationsDesign(),
    generation = designGeneration(raw);
  const reader = generation?.selections.find((s) => s.binding.kind === "positive-cache-read"),
    limiter = generation?.selections.find((s) => s.binding.kind === "rate-limiter");
  if (reader?.binding.kind !== "positive-cache-read" || limiter?.binding.kind !== "rate-limiter")
    throw Error("Missing fixture selection");
  reader.binding.cache = structuredClone(limiter.binding.cache);
  expect(
    generationExportBlockers(raw, registry.installed)
      .map((f) => f.message)
      .join("\n"),
  ).toContain("cache reads require LRU eviction; admission requires no eviction");
  const incorrect = {
    ...registry.installed,
    callables: registry.installed.callables?.map((item) =>
      item.contract.id === "cache-reader.read"
        ? { ...item, contract: { ...item.contract, effect: "durable-external-work" as const } }
        : item,
    ),
  };
  const result = resolveGeneration(foundationsDesign(), incorrect);
  expect(result.findings.some((f) => f.message.includes("effect"))).toBe(true);
  expect(result.complete).toBe(false);
});

it("RG22 diagnostics reveal existing capability requirements behind an invalid setting without returning a model", () => {
  const raw = foundationsDesign();
  const cache = raw.architecture?.studio?.elements.find((entry) => entry.element === "records");
  if (!cache) throw Error("Missing cache");
  Reflect.set(cache.settings, "ttlSeconds", 99999999);
  const missing = {
    ...registry.installed,
    callables: registry.installed.callables?.filter(
      (item) => item.contract.id !== "cache-reader.read",
    ),
  };
  const invalid = resolveGeneration(raw, missing);
  expect(invalid.model).toBeUndefined();
  expect(
    invalid.findings.some((entry) =>
      entry.message.includes("Required callable cache-reader.read@1 is not installed"),
    ),
  ).toBe(true);
  Reflect.set(cache.settings, "ttlSeconds", "malformed");
  expect(() => resolveGeneration(raw, missing)).not.toThrow();
  expect(resolveGeneration(raw, missing).model).toBeUndefined();
  Reflect.set(cache.settings, "ttlSeconds", 10);
  const api = raw.architecture?.studio?.elements.find((entry) => entry.element === "items-api");
  if (!api) throw Error("Missing service");
  Reflect.set(api.settings, "requestTimeoutMs", { invalid: true });
  expect(() => resolveGeneration(raw, missing)).not.toThrow();
  expect(resolveGeneration(raw, missing).model).toBeUndefined();
});

for (const [name, fixture] of Object.entries({
  foundations: foundationsDesign,
  sessions: sessionForwardingDesign,
  scheduled: scheduledDesign,
  receipts: receiptDesign,
  webhook: webhookDesign,
}))
  it(`RG22 ${name}: label edits retain mount identities and extension API8`, () => {
    const before = fixture(),
      first = assembleV2({ designJson: JSON.stringify(before) }, registry);
    let renamed = before;
    for (const tile of before.elements) {
      const batch = buildSupportedAuthoringCommand(
          renamed,
          { type: "edit", element: tile.id, name: `Label ${tile.id}` },
          registry.installed,
        ),
        next = applyOperations(renamed, batch.ops);
      if (!next.ok) throw Error(JSON.stringify(next.errors));
      renamed = next.design;
    }
    for (const module of before.architecture?.studio?.components ?? []) {
      const batch = buildSupportedAuthoringCommand(
          renamed,
          { type: "editComponent", component: module.id, name: `Label ${module.id}` },
          registry.installed,
        ),
        next = applyOperations(renamed, batch.ops);
      if (!next.ok) throw Error(JSON.stringify(next.errors));
      renamed = next.design;
    }
    expect(designGeneration(renamed)).toEqual(designGeneration(before));
    const output = assembleV2({ designJson: JSON.stringify(renamed) }, registry);
    const mounts = (bundle: typeof first) =>
      bundle.report.processes?.tiles.map((process) => ({
        tile: process.tile,
        entry: process.entry,
        routes: process.routes.map((route) => ({ method: route.method, path: route.path })),
        loops: process.loops.map((loop) => ({ queue: loop.queue, module: loop.module })),
        environment: process.environment,
        workload: process.workload,
        serviceCalls: process.serviceCalls,
      }));
    expect(mounts(output)).toEqual(mounts(first));
    expect(output.files.map((f) => f.path)).toEqual(first.files.map((f) => f.path));
    expect(output.report.extensionApi.version).toBe(8);
    expect(output.manifest.extensionApi.version).toBe(8);
    expect(output.report.applicationComplete).toBe(false);
    expect(output.report.gaps.some((gap) => gap.required)).toBe(true);
    const model = resolveGeneration(renamed, registry.installed).model;
    expect(
      model?.capabilities.every(
        (c) => c.extensionApiVersion === 8 && c.lifecycle.mechanism === "src/runtime/process.ts",
      ),
    ).toBe(true);
    const paths = new Set(output.files.map((f) => f.path));
    for (const control of normalGenerationControls(renamed, registry.installed)) {
      expect(control.userNeed).toBeTruthy();
      expect(control.consumer).toBeTruthy();
      expect(control.outputPaths.some((path) => paths.has(path))).toBe(true);
      expect(
        "values" in control.supported
          ? control.supported.values.length > 1
          : control.supported.integer.max > control.supported.integer.min,
      ).toBe(true);
    }
  });

import { readFileSync } from "node:fs";
import {
  type ExactContractRef,
  exactContractRefSchema,
  type GenerationInstalledSupport,
  type GenerationInstalledTemplate,
  type GenerationSettingDecision,
  generationRuntime,
  knownGenerationPreset,
  knownGenerationTemplate,
  type NormalizedGeneration,
  sameContractRef,
} from "@jeeves/spec";
import { assertDistinctPaths, assertSafeOutputPath } from "../files.ts";
import { canonicalJson, freeze, refuse, sha256 } from "../json.ts";
import type { V2LocalContributor } from "./local-contract.ts";

export type V2Source = { path: string; bytes: Uint8Array };
export type V2Gap = {
  id: string;
  status: "custom" | "unfinished" | "unsupported";
  description: string;
  sourcePaths: readonly string[];
  /** An optional task can remain in an otherwise complete assembly. */
  required: boolean;
};
export type V2TemplateFile = {
  path: string;
  content: string | Uint8Array;
  ownership: "generated-scaffold" | "generated-extension";
  sourcePaths: readonly string[];
  /** One writer composes the complete file. Other emitters never append or overwrite it. */
  contributors?: readonly { emitter: string; sourcePaths: readonly string[] }[];
};
/** One process's report row (tile process contract, section 1): its service, shape, entry point
 * and settings with their origin, and what each route and loop answers. */
export type V2ProcessReport = {
  tile: string;
  name: string;
  kind: string;
  service: string;
  shape: "http" | "worker";
  exposure?: "public" | "internal";
  /** A public HTTP process's path at the edge, `/api/<tile>/`. */
  edge?: string;
  entry: string;
  settings: readonly {
    setting: string;
    value: number;
    origin: "template" | "fixed";
    selection?: string;
  }[];
  routes: readonly { method: string; path: string; answers: string }[];
  loops: readonly { queue: string; module: string; answers: string }[];
  /** The templates the process runs: mounted on their real libraries, or a placeholder. */
  templates: readonly { selection: string; template: string; level: "mounted" | "placeholder" }[];
  /** Each mounted template's generated hooks file and the hooks that answer "Not implemented". */
  hooks: readonly { selection: string; file: string; hooks: readonly string[] }[];
  /** Each store or channel its stubs use (tile process contract, section 6): the widest access
   * among their links, and what is provisioned for it or why it isn't. */
  stores: readonly {
    store: string;
    name: string;
    kind: string;
    access: string;
    boundary?: "published-read";
    modules: readonly string[];
    provisioned?: string;
    unsupported?: string;
  }[];
};
/** A module's own SQL file in a database it writes (v3 contract, section 1). */
export type V2ModuleSql = { module: string; database: string; file: string; schema: string };
export type V2RenderContext = {
  model: NormalizedGeneration;
  settings: readonly GenerationSettingDecision[];
  /** A fresh copy of a pinned source/asset. No filesystem reads occur during rendering. */
  asset(path: string): Uint8Array;
};
export type V2Emitter = {
  id: string;
  version: string;
  /** Complete trusted implementation/asset closure; semantic descriptor hashes are separate. */
  sourcePaths: readonly string[];
  dependencies?: readonly ExactContractRef[];
  provides?: {
    runtime?: { ref: ExactContractRef; outputPaths: readonly string[] };
    presets?: readonly { ref: ExactContractRef; outputPaths: readonly string[] }[];
    templates?: readonly GenerationInstalledTemplate[];
    /** Runs a process per application tile: emits `src/processes/<tile>.ts` and its row. */
    processes?: true;
  };
  /** Real partial modules may emit useful files without attesting complete implementation. */
  status: "implemented" | "partial" | "diagnostic";
  description: string;
  /** Specific local project hooks; the foundation remains the sole shared-file writer. */
  local?: V2LocalContributor;
  render(context: V2RenderContext): {
    files: readonly V2TemplateFile[];
    gaps?: readonly V2Gap[];
    /** Compiled application recipe may satisfy named dependency hooks after validation. */
    resolves?: readonly { emitter: string; id: string }[];
    /** Only the processes owner, one row per normalized process. */
    processes?: readonly V2ProcessReport[];
    /** Only the runtime owner, with Runnable processes on: each writer module's product SQL. */
    sql?: readonly V2ModuleSql[];
  };
};
export type V2EmitterIdentity = {
  id: string;
  version: string;
  sourceSha256: string;
  sources: { path: string; sha256: string; bytes: number }[];
  dependencies: ExactContractRef[];
};
const compare = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);
export const v2Compare = compare;

/** Called by trusted repository registration, never with source-selected executable paths. */
export function captureV2Sources(root: URL, paths: readonly string[]): V2Source[] {
  assertDistinctPaths(paths);
  return [...paths].sort(compare).map((path) => ({
    path,
    bytes: new Uint8Array(readFileSync(new URL(path, root))),
  }));
}

/** Snapshot bytes once. A host is responsible for supplying the complete executable closure,
 * just as for v1; function.toString() and descriptor SHAs are not implementation fingerprints.
 */
export function createV2Registry(sources: readonly V2Source[], emitters: readonly V2Emitter[]) {
  assertDistinctPaths(sources.map((source) => source.path));
  const pinned = [...sources]
    .sort((a, b) => compare(a.path, b.path))
    .map((source) => ({
      path: source.path,
      sha256: sha256(source.bytes),
      bytes: source.bytes.length,
      base64: Buffer.from(source.bytes).toString("base64"),
    }));
  const records = pinned.map(({ base64: _bytes, ...record }) => record);
  const ids = new Set<string>();
  const sorted = [...emitters]
    .sort((a, b) => compare(a.id, b.id))
    .map((emitter) => {
      if (
        ids.has(emitter.id) ||
        !/^[a-z][a-z0-9.-]{0,100}$/u.test(emitter.id) ||
        !/^\d+\.\d+\.\d+(?:-[a-z0-9.]+)?$/u.test(emitter.version)
      )
        refuse(
          "INVALID_REGISTRY",
          "/registry",
          "Use unique bounded emitter IDs and exact versions.",
        );
      ids.add(emitter.id);
      assertDistinctPaths(emitter.sourcePaths);
      if (
        !emitter.sourcePaths.length ||
        emitter.sourcePaths.some((path) => !pinned.some((source) => source.path === path))
      )
        refuse("INVALID_REGISTRY", emitter.id, "Fingerprint the actual implementation and assets.");
      const provides = structuredClone(emitter.provides ?? {});
      if (
        emitter.status !== "implemented" &&
        (provides.runtime ||
          provides.presets?.length ||
          provides.templates?.length ||
          provides.processes)
      )
        refuse(
          "INVALID_REGISTRY",
          emitter.id,
          "Partial/diagnostic emitters cannot install complete support.",
        );
      if (provides.runtime && !sameContractRef(provides.runtime.ref, generationRuntime.ref))
        refuse("INVALID_REGISTRY", emitter.id, "Unknown runtime descriptor.");
      for (const preset of provides.presets ?? [])
        if (!knownGenerationPreset(preset.ref))
          refuse("INVALID_REGISTRY", emitter.id, "Unknown preset descriptor.");
      for (const template of provides.templates ?? []) {
        if (!knownGenerationTemplate(template.ref))
          refuse("INVALID_REGISTRY", emitter.id, "Unknown template descriptor.");
        const inputs = new Set<string>();
        for (const consumer of template.consumers) {
          if (!consumer.input || !consumer.consumer || inputs.has(consumer.input))
            refuse(
              "INVALID_REGISTRY",
              emitter.id,
              "Consumers require unique input responsibilities.",
            );
          inputs.add(consumer.input);
        }
      }
      const paths = [
        ...(provides.runtime ? [provides.runtime.outputPaths] : []),
        ...(provides.presets ?? []).map((preset) => preset.outputPaths),
        ...(provides.templates ?? []).flatMap((template) =>
          template.consumers.map((consumer) => consumer.outputPaths),
        ),
      ];
      for (const outputPaths of paths) {
        if (!outputPaths.length)
          refuse("INVALID_REGISTRY", emitter.id, "Support needs actual output responsibility.");
        assertDistinctPaths(outputPaths);
        for (const path of outputPaths) {
          assertSafeOutputPath(path);
          if (path.toLowerCase().startsWith(".jeeves/"))
            refuse(
              "RESERVED_OUTPUT_PATH",
              path,
              "Provenance files cannot attest implemented behavior.",
            );
        }
      }
      const dependencies = (emitter.dependencies ?? [])
        .map((ref) => exactContractRefSchema.parse(ref))
        .sort((a, b) => compare(canonicalJson(a), canonicalJson(b)));
      const sourceRecords = records.filter((record) => emitter.sourcePaths.includes(record.path));
      const identity: V2EmitterIdentity = {
        id: emitter.id,
        version: emitter.version,
        sourceSha256: sha256(canonicalJson(sourceRecords)),
        sources: sourceRecords,
        dependencies,
      };
      return freeze({
        ...emitter,
        sourcePaths: [...emitter.sourcePaths].sort(compare),
        provides,
        identity,
        dependencies,
      });
    });
  const runtimeOwners = sorted.filter((emitter) => emitter.provides.runtime);
  const processOwners = sorted.filter((emitter) => emitter.provides.processes);
  const presets = sorted.flatMap((emitter) => emitter.provides.presets ?? []);
  const templates = sorted.flatMap((emitter) => emitter.provides.templates ?? []);
  if (
    runtimeOwners.length > 1 ||
    processOwners.length > 1 ||
    new Set(presets.map((preset) => preset.ref.id)).size !== presets.length ||
    new Set(templates.map((template) => template.ref.id)).size !== templates.length
  )
    refuse(
      "INVALID_REGISTRY",
      "/registry",
      "Install one owner per exact runtime/preset/template responsibility.",
    );
  const installed: GenerationInstalledSupport = {
    ...(runtimeOwners[0]?.provides.runtime && { runtime: runtimeOwners[0].provides.runtime.ref }),
    presets: presets.map((preset) => preset.ref),
    templates,
    ...(processOwners.length && { processes: true as const }),
  };
  const descriptor = sorted.map(({ render: _render, identity, provides, status, description }) => ({
    identity,
    provides,
    status,
    description,
  }));
  return freeze({
    emitters: sorted,
    installed,
    sources: records,
    sha256: sha256(canonicalJson({ sources: records, emitters: descriptor })),
    asset(path: string) {
      const source = pinned.find((item) => item.path === path);
      if (!source) refuse("UNKNOWN_ASSET", path, "Only pinned registry assets can be rendered.");
      return new Uint8Array(Buffer.from(source.base64, "base64"));
    },
  });
}
export type V2Registry = ReturnType<typeof createV2Registry>;

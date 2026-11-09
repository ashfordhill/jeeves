import { designGeneration, resolveGeneration, sameContractRef } from "@jeeves/spec";
import { assertDistinctPaths, type BundleFile } from "../files.ts";
import {
  atPointer,
  canonicalJson,
  freeze,
  jsonFile,
  pointerPart,
  refuse,
  sha256,
} from "../json.ts";
import { type V2Input, validateV2Input } from "./input.ts";
import { type V2EmitterIdentity, type V2Gap, type V2Registry, v2Compare } from "./registry.ts";

const metadata = ".jeeves/";
const pointer = (parts: readonly (string | number)[]) =>
  `/${parts.map((part) => pointerPart(String(part))).join("/")}`;

/** No I/O: render only the immutable normalized model and captured trusted registry bytes.
 * Complete here means emitted support/hooks, never build/runtime proof or TinyURL readiness.
 */
export function assembleV2(inputValue: V2Input, registry: V2Registry) {
  const input = validateV2Input(inputValue);
  const resolution = resolveGeneration(input.design, registry.installed);
  if (!resolution.model) refuse("INVALID_GENERATION", "/generation", jsonFile(resolution.findings));
  const model = resolution.model;
  const generation = designGeneration(input.design);
  if (!generation) refuse("GENERATION_REQUIRED", "/generation", "Explicit generation is required.");
  const normalizedInputSha256 = sha256(canonicalJson(model));
  const checkSources = (paths: readonly string[]) => {
    if (new Set(paths).size !== paths.length)
      refuse("INVALID_SOURCE_PATH", "/sourcePaths", "Contributing declarations must be distinct.");
    for (const path of paths) {
      if (!path.startsWith("/"))
        refuse("INVALID_SOURCE_PATH", path, "Use exact design JSON pointers.");
      atPointer(input.rawDesign, path);
    }
    return [...paths].sort(v2Compare);
  };
  type Record = {
    path: string;
    sha256: string;
    bytes: number;
    ownership: "generated-scaffold" | "generated-extension" | "generator-metadata";
    owner: V2EmitterIdentity | "assembler";
    sourcePaths: string[];
    contributors: { emitter: V2EmitterIdentity; sourcePaths: string[] }[];
  };
  const files: BundleFile[] = [],
    records: Record[] = [];
  const gaps: (V2Gap & { emitter: string })[] = [];
  const resolved: { emitter: string; id: string }[] = [];
  for (const emitter of registry.emitters) {
    const rendered = emitter.render(
      freeze({
        model,
        settings: resolution.settings,
        asset(path: string) {
          if (!emitter.sourcePaths.includes(path))
            refuse(
              "UNKNOWN_ASSET",
              path,
              "An emitter can read only its fingerprinted source/asset closure.",
            );
          return registry.asset(path);
        },
      }),
    );
    resolved.push(...(rendered.resolves ?? []));
    for (const file of rendered.files) {
      if (file.path.toLowerCase() === ".jeeves" || file.path.toLowerCase().startsWith(metadata))
        refuse("RESERVED_OUTPUT_PATH", file.path, "The assembler owns provenance output.");
      const bytes =
        typeof file.content === "string"
          ? new TextEncoder().encode(file.content)
          : new Uint8Array(file.content);
      const contributors = (file.contributors ?? [])
        .map((contribution) => {
          const contributor = registry.emitters.find((item) => item.id === contribution.emitter);
          if (!contributor || contributor.id === emitter.id)
            refuse(
              "INVALID_CONTRIBUTOR",
              file.path,
              "Name another installed emitter; the writer already owns the file.",
            );
          return {
            emitter: contributor.identity,
            sourcePaths: checkSources(contribution.sourcePaths),
          };
        })
        .sort((a, b) => v2Compare(a.emitter.id, b.emitter.id));
      if (new Set(contributors.map((item) => item.emitter.id)).size !== contributors.length)
        refuse("INVALID_CONTRIBUTOR", file.path, "Contributing emitters must be unique.");
      files.push({ path: file.path, bytes });
      records.push({
        path: file.path,
        sha256: sha256(bytes),
        bytes: bytes.length,
        ownership: file.ownership,
        owner: emitter.identity,
        sourcePaths: checkSources(file.sourcePaths),
        contributors,
      });
    }
    for (const gap of rendered.gaps ?? []) {
      if (
        !gap.id ||
        !gap.description ||
        gaps.some((item) => item.emitter === emitter.id && item.id === gap.id)
      )
        refuse(
          "INVALID_GAP",
          emitter.id,
          "Gaps require unique local IDs and a concrete description.",
        );
      gaps.push({ ...gap, sourcePaths: checkSources(gap.sourcePaths), emitter: emitter.id });
    }
    if (emitter.status === "partial")
      gaps.push({
        id: "partial-implementation",
        emitter: emitter.id,
        required: true,
        status: "unfinished",
        description: emitter.description,
        sourcePaths: [],
      });
  }
  assertDistinctPaths(files.map((file) => file.path));
  for (const hook of resolved) {
    const index = gaps.findIndex((gap) => gap.emitter === hook.emitter && gap.id === hook.id);
    if (index < 0)
      refuse(
        "INVALID_RESOLVED_HOOK",
        hook.id,
        "A recipe must satisfy an actual emitted dependency hook.",
      );
    gaps.splice(index, 1);
  }
  // Installed claims must name actual output, owned by this implementation or explicitly
  // composed by a single file owner on its behalf. Advertising a path does not establish support.
  const verifyOutputs = (emitter: string, outputPaths: readonly string[]) => {
    for (const path of outputPaths) {
      const record = records.find((file) => file.path === path);
      if (
        !record ||
        !(
          (typeof record.owner !== "string" && record.owner.id === emitter) ||
          record.contributors.some((item) => item.emitter.id === emitter)
        )
      )
        refuse(
          "MISSING_CONSUMER_OUTPUT",
          path,
          `${emitter} must actually emit or explicitly contribute to its attested consumer file.`,
        );
    }
  };
  for (const emitter of registry.emitters) {
    const provides = emitter.provides;
    if (provides.runtime && sameContractRef(provides.runtime.ref, model.runtime))
      verifyOutputs(emitter.id, provides.runtime.outputPaths);
    for (const preset of provides.presets ?? [])
      if (model.preset && sameContractRef(preset.ref, model.preset))
        verifyOutputs(emitter.id, preset.outputPaths);
    for (const template of provides.templates ?? [])
      if (model.selections.some((selection) => sameContractRef(selection.template, template.ref)))
        for (const consumer of template.consumers) verifyOutputs(emitter.id, consumer.outputPaths);
  }
  const support = generation.selections.map((declaration, index) => {
    const selection = model.selections.find((item) => item.id === declaration.id);
    const emitter = registry.emitters.find((item) =>
      item.provides.templates?.some((template) =>
        sameContractRef(template.ref, declaration.template),
      ),
    );
    const installed = emitter?.provides.templates?.find((template) =>
      sameContractRef(template.ref, declaration.template),
    );
    return {
      selection: declaration.id,
      template: declaration.template,
      sourcePath: `/generation/selections/${index}`,
      status: !selection
        ? ("unsupported" as const)
        : installed
          ? ("implemented" as const)
          : ("unfinished" as const),
      ...(emitter && { emitter: emitter.identity }),
      consumers: installed?.consumers ?? [],
      fixedPolicies: (selection?.policies ?? []).map((policy) => ({
        ref: policy.ref,
        status: installed?.consumers.some(
          (consumer) =>
            consumer.input === `policy.${policy.ref.id}` &&
            consumer.consumer === declaration.binding.kind,
        )
          ? "fixed-policy"
          : "unfinished",
      })),
    };
  });
  // A known template missing a required input consumer is incomplete even if some files exist.
  for (const selection of support)
    if (
      selection.status !== "unsupported" &&
      (resolution.findings.some(
        (finding) =>
          finding.target.path &&
          pointer(finding.target.path).startsWith(`${selection.sourcePath}/`),
      ) ||
        resolution.settings.some(
          (setting) =>
            setting.selection === selection.selection &&
            (setting.status === "unsupported" ||
              setting.status === "missing" ||
              !setting.outputPaths.length),
        ))
    )
      selection.status = "unfinished";
  gaps.sort((a, b) => v2Compare(`${a.emitter}/${a.id}`, `${b.emitter}/${b.id}`));
  const report = freeze({
    format: "jeeves-v2-support-v1",
    semanticComplete: resolution.complete,
    applicationComplete: resolution.complete && !gaps.some((gap) => gap.required),
    runtimeVerification: "none",
    strictReadiness: "not-assessed",
    implementations: registry.emitters.map((emitter) => ({
      ...emitter.identity,
      status: emitter.status,
      description: emitter.description,
    })),
    selections: support,
    settings: resolution.settings.map((setting) => ({
      ...setting,
      implementationStatus:
        setting.status === "unsupported"
          ? "unsupported"
          : setting.status === "missing" || !setting.outputPaths.length
            ? "unfinished"
            : setting.status === "fixed"
              ? "fixed-policy"
              : "implemented",
    })),
    findings: resolution.findings,
    localAdapterTreatments: model.localAdapterTreatments,
    gaps,
  });
  const addMetadata = (path: string, content: string, sourcePaths: string[] = []) => {
    const bytes = new TextEncoder().encode(content);
    files.push({ path, bytes });
    records.push({
      path,
      sha256: sha256(bytes),
      bytes: bytes.length,
      ownership: "generator-metadata",
      owner: "assembler",
      sourcePaths,
      contributors: [],
    });
  };
  addMetadata(`${metadata}inputs/design.json`, input.designJson);
  addMetadata(`${metadata}normalized.json`, jsonFile(model), ["/generation"]);
  addMetadata(`${metadata}report.json`, jsonFile(report), ["/generation"]);
  records.sort((a, b) => v2Compare(a.path, b.path));
  const manifest = freeze({
    format: "jeeves-v2-manifest-v1",
    generator: { id: "jeeves-v2", version: "0.1.0-experimental.1" },
    input: {
      sourceSha256: input.sourceSha256,
      sourceCanonicalSha256: input.sourceCanonicalSha256,
      normalizedInputSha256,
    },
    registry: { sha256: registry.sha256, sources: registry.sources },
    runtime: model.runtime,
    ...(model.preset && { preset: model.preset }),
    templates: generation.selections.map((selection) => ({
      selection: selection.id,
      ref: selection.template,
    })),
    implementations: registry.emitters.map((emitter) => emitter.identity),
    dependencies: registry.emitters.flatMap((emitter) => emitter.dependencies),
    files: records,
  });
  // The manifest excludes itself; every other payload byte, including the report, is covered.
  files.push({
    path: `${metadata}manifest.json`,
    bytes: new TextEncoder().encode(jsonFile(manifest)),
  });
  assertDistinctPaths(files.map((file) => file.path));
  files.sort((a, b) => v2Compare(a.path, b.path));
  return { files, manifest, report };
}

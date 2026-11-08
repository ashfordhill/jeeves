import { assertDistinctPaths, type BundleFile } from "./files.ts";
import type { ExperimentalInput, ValidatedInput } from "./input.ts";
import { validateExperimentalInput } from "./input.ts";
import { atPointer, freeze, type Json, jsonFile, pointerPart, refuse, sha256 } from "./json.ts";
import { customGaps, generatorIdentity, type TemplateId, templateIds } from "./profile.ts";

export interface MappingTarget {
  kind: "element" | "component";
  id: string;
  sourcePath: string;
  templateId: TemplateId;
}
export interface TemplateFile {
  path: string;
  content: string | Uint8Array;
  ownership: "generated-scaffold" | "generated-extension";
  /** Exact contributing source declarations; [] is permitted for shared project files. */
  sourcePaths: string[];
}
export type SettingStatus =
  | "emitted"
  | "configuration-only"
  | "custom"
  | "unsupported"
  | "unimplemented";
export interface SettingDecision {
  /** artifact distinguishes local binding choices from the actual saved source. */
  artifact: "design.json" | "local-bindings.json";
  sourcePath: string;
  status: Exclude<SettingStatus, "unimplemented">;
  note: string;
  outputPaths?: string[];
}
export interface ExperimentalTemplate {
  id: TemplateId;
  version: string;
  /** Fingerprint of the actual versioned template source, supplied by trusted registry code. */
  sourceSha256: string;
  render(context: { input: ValidatedInput; targets: readonly MappingTarget[] }): {
    files: TemplateFile[];
    settings?: SettingDecision[];
  };
}
export interface SettingReport extends Omit<SettingDecision, "status"> {
  value: Json;
  status: SettingStatus;
  template?: { id: TemplateId; version: string; sourceSha256: string };
}

function leaves(value: unknown, path: string): { sourcePath: string; value: Json }[] {
  if (value && typeof value === "object" && Object.keys(value).length)
    return Object.entries(value).flatMap(([key, item]) =>
      leaves(item, `${path}/${pointerPart(key)}`),
    );
  return [{ sourcePath: path, value: value as Json }];
}
function settingInventory(input: ValidatedInput): SettingReport[] {
  const studio = input.design.architecture?.studio;
  if (!studio) return [];
  const values = [
    ...studio.elements.flatMap((item, i) =>
      leaves(item.settings, `/architecture/studio/elements/${i}/settings`),
    ),
    ...(studio.components ?? []).flatMap((item, i) =>
      leaves(item.settings, `/architecture/studio/components/${i}/settings`),
    ),
    ...studio.connections.flatMap((item, i) =>
      Object.keys(item.settings).length
        ? leaves(item.settings, `/architecture/studio/connections/${i}/settings`)
        : [],
    ),
    ...input.design.connections.flatMap((item, i) =>
      leaves(item.planned, `/connections/${i}/planned`),
    ),
  ].map(
    (item): SettingReport => ({
      ...item,
      artifact: "design.json",
      status: "unimplemented",
      note: "No installed template accounts for this declared setting; source intent grants no functional credit.",
    }),
  );
  values.push(
    ...leaves(input.bindings.localConfig, "/localConfig").map(
      (item): SettingReport => ({
        ...item,
        artifact: "local-bindings.json",
        status: "unimplemented",
        note: "Frozen local binding policy; no implementation is supplied by the assembly foundation.",
      }),
    ),
  );
  for (const override of input.bindings.explicitUnsupportedIntent) {
    const item = values.find(
      (setting) => setting.artifact === "design.json" && setting.sourcePath === override.sourcePath,
    );
    if (!item)
      refuse(
        "INVALID_OVERRIDE",
        override.sourcePath,
        "Unsupported intent must name an inventoried source setting.",
      );
    item.status = "unsupported";
    item.note = `${override.classification}: ${override.localBinding}`;
  }
  return values.sort((a, b) =>
    `${a.artifact}${a.sourcePath}` < `${b.artifact}${b.sourcePath}` ? -1 : 1,
  );
}
const metadataPath = ".jeeves/";
const identity = (template: ExperimentalTemplate) => ({
  id: template.id,
  version: template.version,
  sourceSha256: template.sourceSha256,
});

/** Trusted local templates only; there is no plugin loading or input-selected executable code.
 * The default empty registry remains a diagnostic partial bundle, not an app.
 */
export function assembleExperimental(
  inputValue: ExperimentalInput,
  registry: readonly ExperimentalTemplate[] = [],
) {
  const input = validateExperimentalInput(inputValue);
  const diagramPng = input.diagramPng ? new Uint8Array(input.diagramPng) : undefined;
  const targets: MappingTarget[] = [
    ...input.bindings.elements.map(
      (item): MappingTarget => ({
        kind: "element",
        id: item.elementId,
        sourcePath: item.sourcePath,
        templateId: item.proposedTemplateId,
      }),
    ),
    ...input.bindings.components.map(
      (item): MappingTarget => ({
        kind: "component",
        id: item.componentId,
        sourcePath: item.sourcePath,
        templateId: item.proposedTemplateId,
      }),
    ),
  ];
  const sortedRegistry = [...registry].sort((a, b) => (a.id < b.id ? -1 : 1));
  if (new Set(registry.map((template) => template.id)).size !== registry.length)
    refuse("DUPLICATE_TEMPLATE", "/registry", "Install one exact version per template ID.");
  for (const template of sortedRegistry) {
    if (
      !(templateIds as readonly string[]).includes(template.id) ||
      !/^\d+\.\d+\.\d+(?:-[a-z0-9.]+)?$/u.test(template.version) ||
      !/^[a-f0-9]{64}$/u.test(template.sourceSha256)
    )
      refuse(
        "UNRECOGNIZED_TEMPLATE",
        "/registry",
        "Use a bounded known template ID, exact version and source SHA256.",
      );
  }
  const settings = settingInventory(input);
  const decisions = new Set<string>();
  const files: BundleFile[] = [];
  const provenance: {
    path: string;
    sha256: string;
    bytes: number;
    ownership: string;
    sourcePaths: string[];
    template: ReturnType<typeof identity> | null;
  }[] = [];
  function add(
    file: BundleFile,
    ownership: string,
    sourcePaths: string[],
    template: ReturnType<typeof identity> | null,
  ) {
    files.push({ path: file.path, bytes: new Uint8Array(file.bytes) });
    provenance.push({
      path: file.path,
      bytes: file.bytes.length,
      sha256: sha256(file.bytes),
      ownership,
      sourcePaths: [...sourcePaths].sort(),
      template,
    });
  }
  for (const template of sortedRegistry) {
    const selected = targets.filter((target) => target.templateId === template.id);
    const result = template.render({ input, targets: freeze(selected) });
    for (const file of result.files) {
      if (file.path.toLowerCase().startsWith(metadataPath))
        refuse("RESERVED_OUTPUT_PATH", file.path, "Generator metadata is reserved.");
      if (!["generated-scaffold", "generated-extension"].includes(file.ownership))
        refuse(
          "INVALID_OWNERSHIP",
          file.path,
          "Template output is always generated, including initial extension files.",
        );
      for (const path of file.sourcePaths) {
        atPointer(input.design, path);
        if (
          template.id !== "local.project" &&
          !selected.some(
            (target) => path === target.sourcePath || path.startsWith(`${target.sourcePath}/`),
          )
        )
          refuse(
            "INVALID_PROVENANCE",
            path,
            "A template must cite its exact selected declarations.",
          );
      }
      add(
        {
          path: file.path,
          bytes:
            typeof file.content === "string"
              ? new TextEncoder().encode(file.content)
              : file.content,
        },
        file.ownership,
        file.sourcePaths,
        identity(template),
      );
    }
    for (const decision of result.settings ?? []) {
      const key = `${decision.artifact}:${decision.sourcePath}`;
      const item = settings.find(
        (setting) =>
          setting.artifact === decision.artifact && setting.sourcePath === decision.sourcePath,
      );
      if (!item || decisions.has(key) || item.status === "unsupported")
        refuse(
          "INVALID_SETTING_DECISION",
          key,
          "Unknown, duplicate or frozen unsupported setting decision.",
        );
      if (
        template.id !== "local.project" &&
        (decision.artifact !== "design.json" ||
          !selected.some((target) =>
            decision.sourcePath.startsWith(`${target.sourcePath}/settings/`),
          ))
      )
        refuse(
          "INVALID_SETTING_DECISION",
          key,
          "Setting must belong to this template's selected declaration.",
        );
      if (
        !["emitted", "configuration-only", "custom", "unsupported"].includes(decision.status) ||
        !decision.note.trim()
      )
        refuse(
          "INVALID_SETTING_DECISION",
          key,
          "A setting requires an explicit status and explanation.",
        );
      if (
        ["emitted", "configuration-only"].includes(decision.status) &&
        !decision.outputPaths?.length
      )
        refuse(
          "INVALID_SETTING_DECISION",
          key,
          "Emitted/configuration-only settings must name actual emitted files.",
        );
      for (const path of decision.outputPaths ?? [])
        if (!result.files.some((file) => file.path === path))
          refuse(
            "INVALID_SETTING_DECISION",
            key,
            "Evidence must reference a file emitted by this template.",
          );
      Object.assign(item, decision, { template: identity(template) });
      decisions.add(key);
    }
  }
  // Never expose input-owned image bytes to template mutation before copying them into output.
  for (const [name, text] of Object.entries(input.artifacts))
    add(
      { path: `${metadataPath}inputs/${name}`, bytes: new TextEncoder().encode(text) },
      "input-snapshot",
      [],
      null,
    );
  if (diagramPng)
    add(
      { path: `${metadataPath}inputs/diagram.png`, bytes: diagramPng },
      "input-snapshot",
      [],
      null,
    );
  const installed = new Set(registry.map((template) => template.id));
  const report = freeze({
    format: "jeeves-experimental-scaffold-report-v1",
    status: "partial" as const,
    applicationComplete: false,
    runtimeVerification: "none",
    functionalCoverage: "unmeasured; emitted files/configuration are not proof of working behavior",
    strictReadiness: input.blueprint.readiness,
    strictTemplateAvailability: input.blueprint.templateAvailability,
    strictRuntimeVerification: input.blueprint.runtimeVerification,
    mappings: targets.map((target) => ({
      ...target,
      availability: installed.has(target.templateId)
        ? "experimental-template-installed"
        : "unavailable",
      version: registry.find((template) => template.id === target.templateId)?.version ?? null,
    })),
    connections: input.bindings.connections,
    settings,
    extensionTasks: input.bindings.components
      .filter((item) => item.requiredSettings.kind === "custom")
      .map((item) => ({
        id: item.componentId,
        hostId: item.hostId,
        sourcePath: item.sourcePath,
        status: "unimplemented",
        task: "Explicit business behavior extension; no algorithm is inferred from names or prose.",
      })),
    gaps: customGaps,
    scenarios: ["S01", "S02", "S03", "S04", "S05", "S06", "S07", "S08"].map((id) => ({
      id,
      status: "not-run",
    })),
    limitations: [
      "Only frozen youtube-local-v1 snapshot005 is accepted.",
      registry.length
        ? "Installed experimental templates supply only the output and setting decisions recorded here; no functional verification is claimed."
        : "No installed templates; this foundation alone emits no runnable application.",
      "Template renderers are trusted local code; their version/source fingerprints must change when code changes.",
      "Runtime secrets/data are provisioned later; none are generated here.",
      "Assembly is in memory. A separate exporter can create a new directory; no merge/regeneration or browser generation flow is supplied by assembly.",
    ],
  });
  add(
    { path: `${metadataPath}report.json`, bytes: new TextEncoder().encode(jsonFile(report)) },
    "generator-metadata",
    [],
    null,
  );
  assertDistinctPaths([...files.map((file) => file.path), `${metadataPath}manifest.json`]);
  provenance.sort((a, b) => (a.path < b.path ? -1 : 1));
  const manifest = freeze({
    format: "jeeves-experimental-output-manifest-v1",
    generator: generatorIdentity,
    profile: input.profile,
    inputs: Object.entries(input.artifacts)
      .map(([name, text]) => ({
        name,
        sha256: sha256(text),
        bytes: new TextEncoder().encode(text).length,
      }))
      .sort((a, b) => (a.name < b.name ? -1 : 1)),
    source: {
      schemaVersion: input.design.schemaVersion,
      revision: input.design.revision,
      canonicalSha256: input.profile.sourceCanonicalSha256,
      blueprintVersion: input.blueprint.blueprint,
    },
    diagram: {
      ...input.profile.diagram,
      snapshot: input.profile.sourceSnapshot,
      included: !!diagramPng,
    },
    runtimePins: input.runtimePins,
    templates: sortedRegistry.map(identity),
    files: provenance,
    manifestHashScope:
      "files excludes .jeeves/manifest.json to avoid a self-reference; hash the final manifest externally if needed",
    ownershipPolicy:
      "All emitted template files start generated; edited files require explicit repair/integration classification. Export never authorizes overwriting edits.",
  });
  files.push({
    path: `${metadataPath}manifest.json`,
    bytes: new TextEncoder().encode(jsonFile(manifest)),
  });
  files.sort((a, b) => (a.path < b.path ? -1 : 1));
  return { files, manifest, report };
}
export type ExperimentalBundle = ReturnType<typeof assembleExperimental>;

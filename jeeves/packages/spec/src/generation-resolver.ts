/** Pure source normalization shared by future assemblers, mouse controls and chat validation. */
import { freezeRecord } from "./content-hash.ts";
import type { DesignDocument } from "./design.ts";
import { type Finding, finding, isStructural } from "./findings.ts";
import {
  designGeneration,
  type GenerationDependency,
  type GenerationSelection,
  generationHost,
  generationReferences,
  generationSchema,
} from "./generation.ts";
import {
  generationPolicies,
  generationRuntime,
  knownGenerationPreset,
  knownGenerationTemplate,
} from "./generation-catalog.ts";
import {
  type GenerationInstalledSupport,
  type GenerationSettingRule,
  type GenerationSupportedValues,
  type GenerationValue,
  generationCapabilities,
} from "./generation-support.ts";
import { idSchema } from "./ids.ts";
import { sameContractRef } from "./operation-records.ts";
import { accessAllows, designOwnership } from "./ownership.ts";
import type { StudioComponent } from "./studio-components.ts";
import { studioDefinitionStatus } from "./studio-model.ts";
import { validateDesign } from "./validate.ts";

type Path = (string | number)[];
export type GenerationSettingDecision = {
  selection: string;
  input: string;
  sourcePaths: Path[];
  origin: "source" | "descriptor-default" | "missing";
  value?: GenerationValue;
  supported: GenerationSupportedValues;
  consumer: string;
  outputPaths: string[];
  status: "supported" | "fixed" | "unsupported" | "missing";
  userNeed?: string;
  normalControl: boolean;
};
export type NormalizedGenerationSelection = {
  id: string;
  target: GenerationSelection["target"];
  host: string;
  owner?: string;
  roleSourcePath?: Path;
  template: GenerationSelection["template"];
  binding: GenerationSelection["binding"];
  sourcePath: Path;
  identity?: {
    element: string;
    guard: string;
    provider: "keycloak";
    credential: "jwt";
    sourcePaths: Path[];
  };
  inputs: Record<string, GenerationValue>;
  resources: {
    field: string;
    element: string;
    connection: string;
    sourcePath: Path;
    permissionPaths: Path[];
    identity: { local: string; sql: string };
    authority?: string;
    access?: "read" | "write" | "read-write";
    declaredAccess?: "read" | "write" | "read-write";
    boundary?: "published-read";
    channel?: "publish" | "consume";
  }[];
  policies: (typeof generationPolicies)[keyof typeof generationPolicies][];
};
export type NormalizedGeneration = {
  version: 1;
  runtime: GenerationSelection["template"];
  preset?: GenerationSelection["template"];
  selections: NormalizedGenerationSelection[];
  localAdapterTreatments: {
    sourcePath: Path;
    declared: GenerationValue;
    actual: string;
    classification: "unsupported-intent";
    reason: string;
  }[];
};
const supports = (support: GenerationSupportedValues, value: GenerationValue) =>
  "values" in support
    ? support.values.includes(value)
    : typeof value === "number" &&
      Number.isInteger(value) &&
      value >= support.integer.min &&
      value <= support.integer.max;
/** Bijection on strict canonical slugs: no truncation, lossy sanitization or label-derived names. */
export function generationLocalIdentity(element: string) {
  const local = idSchema.parse(element);
  return { local, sql: local.replaceAll("-", "_") };
}
const safeOutputPath = (path: string) =>
  path.length > 0 &&
  !path.includes("\\") &&
  !path.startsWith("/") &&
  path.split("/").every((part) => /^[a-zA-Z0-9_.-]+$/.test(part) && part !== "." && part !== "..");

export function resolveGeneration(
  design: DesignDocument,
  installed: GenerationInstalledSupport = { templates: [] },
) {
  const findings: Finding[] = [];
  const settings: GenerationSettingDecision[] = [];
  const report = (
    code: "CONFIG_INVALID" | "CONFIG_REQUIRED" | "NEEDS_TEMPLATE",
    path: Path,
    message: string,
  ) => findings.push(finding(code, message, { path }));
  const raw = designGeneration(design);
  if (!raw) return freezeRecord({ model: undefined, findings, settings, complete: false });
  const parsed = generationSchema.safeParse(raw);
  if (!parsed.success) {
    for (const issue of parsed.error.issues)
      report(
        "CONFIG_INVALID",
        ["generation", ...issue.path.map((p) => (typeof p === "number" ? p : String(p)))],
        issue.message,
      );
    return freezeRecord({ model: undefined, findings, settings, complete: false });
  }
  // Structural source checks apply even to historic documents. Readiness is resolved below only
  // for selected behavior; strict TinyURL/legacy operation evidence is a separate contract.
  findings.push(...validateDesign(design).filter(isStructural));
  const generation = parsed.data;
  const runtimeInstalled =
    !!installed.runtime &&
    sameContractRef(installed.runtime, generation.runtime) &&
    sameContractRef(generation.runtime, generationRuntime.ref);
  if (!runtimeInstalled)
    report(
      "NEEDS_TEMPLATE",
      ["generation", "runtime"],
      "Exact local runtime implementation is not installed by the host.",
    );
  const preset = generation.preset;
  if (
    preset &&
    (!knownGenerationPreset(preset) ||
      !installed.presets?.some((ref) => sameContractRef(ref, preset)))
  )
    report(
      "NEEDS_TEMPLATE",
      ["generation", "preset"],
      "Exact preset composition is not installed by the host.",
    );
  if (preset) {
    const definition = knownGenerationPreset(preset)?.definition;
    for (const required of definition?.templates ?? [])
      if (!generation.selections.some((selection) => sameContractRef(selection.template, required)))
        report(
          "CONFIG_REQUIRED",
          ["generation", "selections"],
          `Selected preset requires an explicit ${required.id} selection; parsing never attaches one.`,
        );
  }
  for (const template of installed.templates) {
    const entries = installed.templates.filter((entry) => sameContractRef(entry.ref, template.ref));
    if (entries.length !== 1)
      report("CONFIG_INVALID", ["generation"], "Installed template identities must be unique.");
    const keys = new Set<string>();
    for (const consumer of template.consumers) {
      if (
        keys.has(consumer.input) ||
        consumer.outputPaths.length === 0 ||
        !consumer.outputPaths.every(safeOutputPath)
      )
        report(
          "CONFIG_INVALID",
          ["generation"],
          "Installed consumer inputs must be unique and name safe relative output paths.",
        );
      keys.add(consumer.input);
    }
  }
  const ownership = designOwnership(design);
  const studio = design.architecture?.studio;
  const element = (id: string) => studio?.elements.find((entry) => entry.element === id);
  const elementPath = (id: string): Path => [
    "architecture",
    "studio",
    "elements",
    studio?.elements.findIndex((entry) => entry.element === id) ?? -1,
    "settings",
  ];
  const componentPath = (id: string): Path => [
    "architecture",
    "studio",
    "components",
    studio?.components?.findIndex((entry) => entry.id === id) ?? -1,
    "settings",
  ];
  const traced = (
    host: string,
    dependency: GenerationDependency | undefined,
    kind: StudioComponent["settings"]["kind"],
  ) =>
    (studio?.components ?? []).filter(
      (component) =>
        component.host === host &&
        component.settings.kind === kind &&
        !!dependency &&
        studio?.componentConnections?.some(
          (link) =>
            link.from === component.id &&
            link.to.kind === "element" &&
            link.to.id === dependency.resource &&
            link.to.via === dependency.connection,
        ),
    );
  const dependencyOf = (
    selection: GenerationSelection,
    field: string,
  ): GenerationDependency | undefined =>
    generationReferences(selection.binding).resources.find((ref) => ref.field === field)
      ?.dependency;
  const normalized: NormalizedGenerationSelection[] = [];
  const localAdapterTreatments: NormalizedGeneration["localAdapterTreatments"] = [];
  generation.selections.forEach((selection, index) => {
    const base: Path = ["generation", "selections", index];
    const known = knownGenerationTemplate(selection.template);
    const implementation =
      known && installed.templates.find((entry) => sameContractRef(entry.ref, selection.template));
    if (!implementation)
      report(
        "NEEDS_TEMPLATE",
        [...base, "template"],
        "Exact selected template implementation is not installed; catalog presence grants no support.",
      );
    if (!known || known.definition.binding !== selection.binding.kind) return;
    const capability = generationCapabilities[selection.binding.kind];
    const host = generationHost(selection);
    const hostBinding = element(host);
    const role = ownership.roles.find((entry) => entry.element === host);
    if (!role)
      report(
        "CONFIG_REQUIRED",
        [...base, "target"],
        "Selected host requires an explicit logical owner and role.",
      );
    else if (role.kind !== capability.role)
      report(
        "CONFIG_INVALID",
        [...base, "target"],
        `Template requires an explicit ${capability.role} role.`,
      );
    if (
      hostBinding &&
      studioDefinitionStatus(hostBinding.definition, hostBinding.settings.kind) !== "known"
    )
      report(
        "NEEDS_TEMPLATE",
        [...elementPath(host).slice(0, -1), "definition"],
        "Selected host has an unresolved studio definition.",
      );
    if (hostBinding && !capability.hosts.some((kind) => kind === hostBinding.settings.kind))
      report(
        "CONFIG_INVALID",
        [...base, "target"],
        `Template requires host kind ${capability.hosts.join(" or ")}.`,
      );
    if (selection.target.kind === "component") {
      const component = studio?.components?.find(
        (entry) =>
          entry.id === (selection.target.kind === "component" ? selection.target.component : ""),
      );
      if (
        component &&
        !capability.componentTargets.some((kind) => kind === component.settings.kind)
      )
        report(
          "CONFIG_INVALID",
          [...base, "target", "component"],
          "Component kind does not implement this template responsibility.",
        );
    }
    const row: NormalizedGenerationSelection = {
      id: selection.id,
      target: structuredClone(selection.target),
      host,
      ...(role && {
        owner: role.owner,
        roleSourcePath: ["ownership", "roles", ownership.roles.indexOf(role)],
      }),
      template: structuredClone(selection.template),
      binding: structuredClone(selection.binding),
      sourcePath: base,
      inputs: {},
      resources: [],
      policies: Object.values(generationPolicies)
        .filter((policy) =>
          known.definition.policies.some((ref) => sameContractRef(ref, policy.ref)),
        )
        .map((policy) => structuredClone(policy)),
    };
    normalized.push(row);
    const consumerFor = (input: string, consumer: string) =>
      implementation?.consumers.find(
        (entry) =>
          entry.input === input &&
          entry.consumer === consumer &&
          entry.outputPaths.length > 0 &&
          entry.outputPaths.every(safeOutputPath),
      );
    for (const [input, consumer] of [
      ["binding", selection.binding.kind],
      ...row.policies.map((policy) => [`policy.${policy.ref.id}`, selection.binding.kind]),
    ]) {
      if (input && consumer && implementation && !consumerFor(input, consumer))
        report(
          "NEEDS_TEMPLATE",
          [...base, "template"],
          `Installed template has no actual output consumer for ${input}.`,
        );
    }
    for (const requirement of capability.resources) {
      const dependency = dependencyOf(selection, requirement.field);
      if (!dependency) continue; // Strict binding schema owns required fields.
      const resource = ownership.resources.find((entry) => entry.element === dependency.resource);
      const binding = element(dependency.resource);
      const path: Path = [...base, "binding", requirement.field];
      if (binding && studioDefinitionStatus(binding.definition, binding.settings.kind) !== "known")
        report(
          "NEEDS_TEMPLATE",
          [...elementPath(dependency.resource).slice(0, -1), "definition"],
          "Bound resource has an unresolved studio definition.",
        );
      if (requirement.access) {
        const grant = ownership.grants.find(
          (entry) => entry.role === host && entry.resource === dependency.resource,
        );
        const access = ownership.dependencies.find(
          (entry) => entry.connection === dependency.connection,
        );
        if (!resource)
          report("CONFIG_REQUIRED", path, "Selected store needs an explicit resource authority.");
        else if (resource.kind !== requirement.authority)
          report(
            "CONFIG_INVALID",
            path,
            `Store requires ${requirement.authority} authority semantics.`,
          );
        if (!grant || !access)
          report(
            "CONFIG_REQUIRED",
            path,
            `Selection requires explicit ${requirement.access} role grant and dependency access; reads never invent permission.`,
          );
        if (
          (grant && !accessAllows(grant.access, requirement.access)) ||
          (access && !accessAllows(access.access, requirement.access)) ||
          (grant && access && !accessAllows(grant.access, access.access))
        )
          report(
            "CONFIG_INVALID",
            path,
            `Declared grant/dependency must allow ${requirement.access}.`,
          );
        if (
          resource &&
          role &&
          role.owner !== resource.authority &&
          (requirement.access !== "read" || grant?.boundary !== "published-read")
        )
          report(
            "CONFIG_INVALID",
            path,
            "Foreign authority permits only an explicitly published read boundary.",
          );
        row.resources.push({
          field: requirement.field,
          element: dependency.resource,
          connection: dependency.connection,
          sourcePath: path,
          permissionPaths: [
            ...(resource
              ? [["ownership", "resources", ownership.resources.indexOf(resource)]]
              : []),
            ...(grant ? [["ownership", "grants", ownership.grants.indexOf(grant)]] : []),
            ...(access
              ? [["ownership", "dependencies", ownership.dependencies.indexOf(access)]]
              : []),
          ],
          identity: generationLocalIdentity(dependency.resource),
          ...(resource && { authority: resource.authority }),
          access: requirement.access,
          ...(grant && {
            declaredAccess: grant.access,
            ...(grant.boundary && { boundary: grant.boundary }),
          }),
        });
      } else
        row.resources.push({
          field: requirement.field,
          element: dependency.resource,
          connection: dependency.connection,
          sourcePath: path,
          permissionPaths: [],
          identity: generationLocalIdentity(dependency.resource),
          channel: requirement.channel,
        });
      const connectionIndex = design.connections.findIndex(
        (entry) => entry.id === dependency.connection,
      );
      const connection = design.connections[connectionIndex];
      if (connection) {
        // Fixed local adapter treatment is explicit; inherited HTTPS/mTLS intent is never honored
        // merely because an S3/OpenSearch client will eventually be emitted.
        const protocol =
          requirement.kind === "database"
            ? "SQL"
            : requirement.kind === "cache"
              ? "Redis"
              : requirement.kind === "queue"
                ? "Messaging"
                : "HTTP";
        for (const [field, supported] of [
          ["protocol", protocol],
          ["security", "Private network"],
          ["interaction", requirement.channel ? "Asynchronous" : "Request / response"],
        ] as const)
          if (connection.planned[field] !== supported)
            report(
              "NEEDS_TEMPLATE",
              ["connections", connectionIndex, "planned", field],
              `Local preset supports ${supported}; declared ${connection.planned[field]} remains unsupported and is preserved.`,
            );
        const connectionSettings = studio?.connections.find(
          (entry) => entry.connection === dependency.connection,
        )?.settings;
        for (const field of ["timeoutMs", "retry"] as const)
          if (connectionSettings?.[field] !== undefined)
            report(
              "NEEDS_TEMPLATE",
              [
                "architecture",
                "studio",
                "connections",
                studio?.connections.findIndex(
                  (entry) => entry.connection === dependency.connection,
                ) ?? -1,
                "settings",
                field,
              ],
              "Connection override has no selected implementation consumer.",
            );
      }
    }
    const consumedPaths = new Set<string>();
    const remember = (path: Path) => consumedPaths.add(JSON.stringify(path));
    const readRule = (rule: GenerationSettingRule) => {
      const dependency = rule.field ? dependencyOf(selection, rule.field) : undefined;
      if (rule.field && !dependency) return;
      let values: { value: unknown; path: Path }[] = [];
      if (rule.source === "host")
        values = [
          {
            value: hostBinding?.settings[rule.setting as keyof typeof hostBinding.settings],
            path: [...elementPath(host), rule.setting],
          },
        ];
      if (rule.source === "resource" && dependency) {
        const target = element(dependency.resource)?.settings;
        values = [
          {
            value: target?.[rule.setting as keyof typeof target],
            path: [...elementPath(dependency.resource), rule.setting],
          },
        ];
      }
      if (rule.source === "component" && rule.component)
        values = traced(host, dependency, rule.component).map((component) => ({
          value: component.settings[rule.setting as keyof typeof component.settings],
          path: [...componentPath(component.id), rule.setting],
        }));
      if (values.length > 1)
        report(
          "CONFIG_INVALID",
          base,
          `Ambiguous component source for ${rule.input}; bind one responsibility per connection.`,
        );
      const source = values[0];
      const rawValue = source?.value ?? rule.default;
      const value =
        typeof rawValue === "string" || typeof rawValue === "number" ? rawValue : undefined;
      if (value === undefined && !rule.required) return;
      const paths = source?.value !== undefined ? [source.path] : [];
      if (source) remember(source.path);
      if (rule.mirror)
        for (const component of traced(
          host,
          dependencyOf(selection, rule.mirror.field),
          rule.mirror.component,
        )) {
          const mirrorValue =
            component.settings[rule.mirror.setting as keyof typeof component.settings];
          const mirrorPath = [...componentPath(component.id), rule.mirror.setting];
          remember(mirrorPath);
          if (mirrorValue !== undefined) {
            paths.push(mirrorPath);
            if (mirrorValue !== value)
              report(
                "CONFIG_INVALID",
                mirrorPath,
                `${rule.input} is authoritative at ${JSON.stringify(source?.path)}; duplicate declarations must agree.`,
              );
          }
        }
      const supported = value !== undefined && supports(rule.supported, value);
      const consumer = consumerFor(rule.input, rule.consumer);
      const decision: GenerationSettingDecision = {
        selection: selection.id,
        input: rule.input,
        sourcePaths: paths,
        origin:
          source?.value !== undefined
            ? "source"
            : rule.default !== undefined
              ? "descriptor-default"
              : "missing",
        ...(value !== undefined && { value }),
        supported: rule.supported,
        consumer: rule.consumer,
        outputPaths: [...(consumer?.outputPaths ?? [])],
        status:
          value === undefined
            ? "missing"
            : !supported
              ? "unsupported"
              : rule.userNeed
                ? "supported"
                : "fixed",
        ...(rule.userNeed && { userNeed: rule.userNeed }),
        normalControl:
          !!rule.userNeed &&
          !!consumer &&
          runtimeInstalled &&
          supported &&
          !!hostBinding &&
          studioDefinitionStatus(hostBinding.definition, hostBinding.settings.kind) === "known",
      };
      settings.push(decision);
      if (value === undefined)
        report(
          "CONFIG_REQUIRED",
          source?.path ?? base,
          `Provide the authoritative ${rule.input} setting.`,
        );
      else if (!supported)
        report(
          "NEEDS_TEMPLATE",
          source?.path ?? base,
          `Unsupported ${rule.input}=${value}; supported values are ${JSON.stringify(rule.supported)}. Source is preserved.`,
        );
      else {
        row.inputs[rule.input] = value;
        if (implementation && !consumer)
          report(
            "NEEDS_TEMPLATE",
            source?.path ?? base,
            `Installed template has no actual output consumer for ${rule.input}.`,
          );
      }
    };
    capability.settings.forEach(readRule);
    // Report every selected setting with no consumer, rather than copying an arbitrary intent
    // map into generated JSON. Adapters delegate their host settings to the selected mechanism.
    const mechanism = !["youtube-upload", "youtube-watch", "youtube-search"].includes(
      selection.binding.kind,
    );
    const audit = (value: object, path: Path, ignored: string[] = []) => {
      for (const key of Object.keys(value))
        if (
          key !== "kind" &&
          !ignored.includes(key) &&
          !consumedPaths.has(JSON.stringify([...path, key]))
        )
          report(
            "NEEDS_TEMPLATE",
            [...path, key],
            "Declared setting has no selected template consumer and remains unsupported.",
          );
    };
    if (mechanism && hostBinding) audit(hostBinding.settings, elementPath(host));
    for (const requirement of capability.resources) {
      const dependency = dependencyOf(selection, requirement.field);
      if (!dependency) continue;
      const target = element(dependency.resource);
      if (target) audit(target.settings, elementPath(dependency.resource));
      for (const kind of [
        "data-access",
        "event-publisher",
        "event-consumer",
        "cache-reader",
      ] as const)
        for (const component of traced(host, dependency, kind)) {
          const ignored = kind === "cache-reader" ? ["pattern", "stampede"] : [];
          audit(component.settings, componentPath(component.id), ignored);
          if (kind === "cache-reader" && component.settings.kind === "cache-reader") {
            for (const [key, expected] of [
              ["pattern", "cache-aside"],
              ["stampede", "single-flight"],
            ] as const)
              if (component.settings[key] !== expected)
                report(
                  "NEEDS_TEMPLATE",
                  [...componentPath(component.id), key],
                  `Positive cache requires fixed ${expected}.`,
                );
          }
        }
    }
    if (selection.binding.kind === "owned-multipart") {
      const identity = selection.binding.identity;
      const guard = studio?.components?.find((entry) => entry.id === identity.guard);
      if (guard?.settings.kind === "auth-guard" && guard.settings.credential !== "jwt")
        report(
          "NEEDS_TEMPLATE",
          [...componentPath(guard.id), "credential"],
          "Local verified-identity adapter supports JWT only.",
        );
      const identityBinding = element(identity.element);
      if (
        guard?.settings.kind === "auth-guard" &&
        guard.settings.credential === "jwt" &&
        identityBinding?.settings.kind === "identity" &&
        identityBinding.settings.provider === "oidc"
      )
        row.identity = {
          element: identity.element,
          guard: guard.id,
          provider: "keycloak",
          credential: "jwt",
          sourcePaths: [
            [...base, "binding", "identity"],
            [...componentPath(guard.id), "credential"],
            [...elementPath(identity.element), "provider"],
          ],
        };
      if (identityBinding?.settings.kind === "identity") {
        for (const [key, expected] of [
          ["execution", "docker"],
          ["provider", "oidc"],
        ] as const)
          if (identityBinding.settings[key] !== expected)
            report(
              "NEEDS_TEMPLATE",
              [...elementPath(identity.element), key],
              `Identity vendor requires fixed ${expected}.`,
            );
        const identityRole = ownership.roles.find((entry) => entry.element === identity.element);
        if (!identityRole)
          report(
            "CONFIG_REQUIRED",
            [...base, "binding", "identity"],
            "Identity requires an explicit vendor API role and authority.",
          );
        else if (identityRole.kind !== "api")
          report(
            "CONFIG_INVALID",
            [...base, "binding", "identity"],
            "Identity vendor requires an API role.",
          );
        if (studioDefinitionStatus(identityBinding.definition, "identity") !== "known")
          report(
            "NEEDS_TEMPLATE",
            [...elementPath(identity.element).slice(0, -1), "definition"],
            "Identity vendor has an unresolved studio definition.",
          );
        for (const key of Object.keys(identityBinding.settings)) {
          if (["kind", "execution", "provider", "language"].includes(key)) continue;
          const value = identityBinding.settings[key as keyof typeof identityBinding.settings];
          const fixed =
            key === "exposure"
              ? "public"
              : key === "minReplicas" || key === "maxReplicas"
                ? 1
                : undefined;
          if (fixed === undefined || value !== fixed)
            report(
              "NEEDS_TEMPLATE",
              [...elementPath(identity.element), key],
              "Identity setting has no local Keycloak consumer; only public exposure and one fixed vendor instance are supported.",
            );
        }
        localAdapterTreatments.push({
          sourcePath: [...elementPath(identity.element), "language"],
          declared: identityBinding.settings.language,
          actual: "keycloak",
          classification: "unsupported-intent",
          reason:
            "Fixed local OIDC vendor substitution. Source requires service-language metadata; neither TypeScript nor Go Identity implementation is provided or claimed.",
        });
      }
    }
    if (selection.binding.kind === "positive-cache-read") {
      const cache = ownership.resources.find(
        (entry) =>
          entry.element ===
          (selection.binding.kind === "positive-cache-read"
            ? selection.binding.cache.resource
            : ""),
      );
      if (cache?.kind === "projection" && cache.source !== selection.binding.source.resource)
        report(
          "CONFIG_INVALID",
          [...base, "binding", "cache"],
          "Cache projection must reference this reader's selected authoritative source.",
        );
    }
    if (selection.binding.kind === "youtube-upload") {
      const binding = selection.binding;
      const lifecycle = generation.selections.find((entry) => entry.id === binding.lifecycle);
      if (lifecycle?.binding.kind === "asset-lifecycle" && !lifecycle.binding.publication)
        report(
          "CONFIG_REQUIRED",
          [...base, "binding", "lifecycle"],
          "YouTube lifecycle requires committed publication output.",
        );
    }
  });
  // A structurally invalid model must never reach a renderer. Unsupported/uninstalled source
  // can still yield a partial diagnostic model, but complete stays false.
  const model: NormalizedGeneration | undefined = findings.some(isStructural)
    ? undefined
    : {
        version: 1,
        runtime: structuredClone(generation.runtime),
        ...(generation.preset && { preset: structuredClone(generation.preset) }),
        selections: normalized,
        localAdapterTreatments,
      };
  if (!model) for (const decision of settings) decision.normalControl = false;
  return freezeRecord({
    model,
    findings,
    settings,
    complete: !!model && findings.length === 0 && normalized.length > 0,
  });
}

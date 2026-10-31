import {
  blocksGenerate,
  type DesignDocument,
  formatTemplateRef,
  type ResourceConfig,
  validateDesign,
} from "@jeeves/spec";
import {
  type ComposeFile,
  type ComposeFragment,
  composeToYaml,
  createGenerateContext,
  type DependencyEntry,
  elementDir,
  type GenerateResult,
  mergeCompose,
  type OutputFile,
  type RuntimePackage,
  vendoredRuntimeSpec,
} from "@jeeves/template-kit";
import {
  type AcceptanceRegistration,
  acceptanceCaseCoverageProblems,
  acceptanceFiles,
  type FixedAcceptance,
  fixedAcceptanceSchema,
} from "./acceptance.ts";
import {
  agentsFile,
  designFile,
  elementNotesFile,
  rootScaffoldFiles,
  type SubjectSummary,
} from "./documents.ts";
import type { TemplateSet } from "./modules.ts";
import {
  applyRecipe,
  type RecipeArtifact,
  type RecipeRegistration,
  recipeForDesign,
} from "./recipes.ts";

export const GENERATOR_VERSION = "0.1.0";

/** One thing a template generates for: an element, or one attachment on it. */
export interface Subject {
  element: string;
  attachment?: string;
  /** `<template id>@<version>` */
  template: string;
}

/** Dependencies and scripts to merge into an element's project-owned `package.json`. */
export interface PackageEdit {
  element: string;
  /** `package.json` path relative to the project root. */
  path: string;
  dependencies: DependencyEntry[];
  scripts: { name: string; command: string }[];
}

export interface PlannedElement {
  id: string;
  template: string;
  dir: string;
  /**
   * Where agent work on this element may change files: its directory (with a trailing slash)
   * plus project-owned files its templates scaffold outside any element directory, such as the
   * API contract its server attachment owns.
   */
  ownedPaths: string[];
}

/** Everything generation will write, computed without touching the disk (deterministic). */
export interface ProjectPlan {
  recipe?: RecipeRegistration;
  artifacts?: RecipeArtifact[];
  fixedAcceptance?: AcceptanceRegistration[];
  resourceModels?: Record<string, ResourceConfig>;
  resourceStores?: Record<string, { connection: string; database: string }>;
  /** Sorted by path. */
  files: OutputFile[];
  compose: ComposeFile;
  packageEdits: PackageEdit[];
  /** Runtime packages the project's elements import, to vendor into `vendor/jeeves/`. */
  runtimes: RuntimePackage[];
  elements: PlannedElement[];
  /** Templates in use, sorted, as `<id>@<version>`. */
  templates: string[];
  subjects: Subject[];
}

export interface PlanOptions {
  fixedAcceptance?: FixedAcceptance[];
  /** Used for the root `package.json` name and the docs; the design has no name of its own. */
  projectName: string;
  resourceHistory?: {
    models: Record<string, ResourceConfig>;
    files: OutputFile[];
    stores?: Record<string, { connection: string; database: string }>;
  };
  reviewedMigrations?: Record<
    string,
    { fromFingerprint: string; toFingerprint: string; sql: string }
  >;
}

export class GenerationError extends Error {}

/**
 * Compiles a design into the files of a template project (PLAN §9). Pure: the same design and
 * templates give the same plan, byte for byte. The design must have no error-level findings.
 */
export function planProject(
  design: DesignDocument,
  templates: TemplateSet,
  options: PlanOptions,
): ProjectPlan {
  const { lookup } = templates;
  const recipe = recipeForDesign(design, lookup);
  if (recipe) {
    const normalized = (suite: FixedAcceptance) =>
      JSON.stringify(
        fixedAcceptanceSchema.parse({
          ...suite,
          requires: suite.requires ?? "extensions",
          runner: suite.runner ?? "node",
          dependencies: suite.dependencies ?? [],
          files: suite.files ?? [],
        }),
      );
    const extra = options.fixedAcceptance ?? [];
    const byId = new Map(recipe.acceptance.map((suite) => [`${suite.service}/${suite.id}`, suite]));
    for (const suite of extra) {
      const key = `${suite.service}/${suite.id}`;
      const fixed = byId.get(key);
      if (fixed && normalized(fixed) !== normalized(suite))
        throw new GenerationError(`Fixed recipe acceptance ${key} cannot be replaced.`);
      if (!fixed) byId.set(key, suite);
    }
    options = { ...options, fixedAcceptance: [...byId.values()] };
  }
  const findings = validateDesign(design, lookup);
  if (blocksGenerate(findings))
    throw new GenerationError(findings.map((f) => f.message).join("\n"));
  for (const id of Object.keys(options.resourceHistory?.models ?? {})) {
    if (
      !design.elements
        .find((e) => e.id === id)
        ?.attachments.some((a) => a.template.id === "rest-api-server" && a.config.model)
    )
      throw new GenerationError(
        `Reviewed migration required: removal of resource model on ${id}. Storage and custom files retained.`,
      );
  }
  const results: { subject: Subject; result: GenerateResult }[] = [];
  const elements: PlannedElement[] = [];
  const runtimes = new Map<string, RuntimePackage>();
  const used = new Set<string>();
  const pendingClients: {
    subject: Subject;
    ctx: ReturnType<typeof createGenerateContext>;
    module: ReturnType<TemplateSet["module"]>;
  }[] = [];

  for (const element of design.elements) {
    if (!element.template) {
      throw new GenerationError(`"${element.name}" needs a template and can't be generated`);
    }
    const manifest = lookup.get(element.template);
    if (manifest?.kind !== "element") {
      throw new GenerationError(`Unknown element template ${formatTemplateRef(element.template)}`);
    }
    elements.push({
      id: element.id,
      template: formatTemplateRef(element.template),
      dir: elementDir(manifest.elementKind, element.id),
      ownedPaths: [],
    });
    const targets = [
      { ref: element.template, attachment: undefined as string | undefined },
      ...element.attachments.map((a) => ({ ref: a.template, attachment: a.id })),
    ];
    for (const target of targets) {
      const module = templates.module(target.ref);
      used.add(formatTemplateRef(target.ref));
      if (module.runtime) runtimes.set(module.runtime.name, module.runtime);
      const ctx = createGenerateContext(design, lookup, element.id, target.attachment);
      if (options.resourceHistory?.models[element.id])
        ctx.previousModel = options.resourceHistory.models[element.id];
      ctx.previousMigrations = options.resourceHistory?.files.filter((f) =>
        f.path.startsWith(`${ctx.dir}/resource-migrations/`),
      );
      ctx.reviewedMigration = options.reviewedMigrations?.[element.id];
      const subject: Subject = {
        element: element.id,
        ...(target.attachment !== undefined && { attachment: target.attachment }),
        template: formatTemplateRef(target.ref),
      };
      if (module.manifest.id === "rest-api-client") pendingClients.push({ subject, ctx, module });
      else results.push({ subject, result: module.generate(ctx) });
    }
  }

  for (const [id, store] of Object.entries(options.resourceHistory?.stores ?? {})) {
    const connection = design.connections.find((c) => c.id === store.connection);
    if (!connection || connection.from.element !== id || connection.to.element !== store.database)
      throw new GenerationError(
        `Reviewed migration/data transfer required: ${id} resource store changed from ${store.database}.`,
      );
  }
  const generatedContracts = Object.fromEntries(
    results
      .flatMap((r) => r.result.files)
      .filter((f) => f.path.startsWith("contracts/") && f.ownership === "generated")
      .map((f) => [f.path, f.contents]),
  );
  for (const { subject, ctx, module } of pendingClients)
    results.push({ subject, result: module.generate({ ...ctx, generatedContracts }) });
  // Keep the pre-existing subject order for locks, documentation and baseline reports.
  results.sort(
    (a, b) =>
      design.elements.findIndex((e) => e.id === a.subject.element) -
        design.elements.findIndex((e) => e.id === b.subject.element) ||
      (a.subject.attachment
        ? design.elements
            .find((e) => e.id === a.subject.element)!
            .attachments.findIndex((t) => t.id === a.subject.attachment) + 1
        : 0) -
        (b.subject.attachment
          ? design.elements
              .find((e) => e.id === b.subject.element)!
              .attachments.findIndex((t) => t.id === b.subject.attachment) + 1
          : 0),
  );
  const fragments: ComposeFragment[] = results.map((r) => r.result.compose);
  const compose = mergeCompose(fragments);

  const files = new Map<string, OutputFile>();
  const add = (file: OutputFile, from: string) => {
    const existing = files.get(file.path);
    if (
      existing &&
      (existing.contents !== file.contents || existing.ownership !== file.ownership)
    ) {
      throw new GenerationError(`Two templates write ${file.path} differently (${from})`);
    }
    files.set(file.path, file);
  };
  for (const { subject, result } of results) {
    for (const file of result.files) add(file, subject.template);
  }
  add({ path: "docker-compose.yml", contents: composeToYaml(compose), ownership: "generated" }, "");

  const dirs = elements.map((e) => `${e.dir}/`);
  for (const element of elements) {
    const outside = results
      .filter((r) => r.subject.element === element.id)
      .flatMap((r) => r.result.files)
      .filter((f) => f.ownership === "scaffold" && !dirs.some((d) => f.path.startsWith(d)))
      .map((f) => f.path);
    element.ownedPaths = [`${element.dir}/`, ...new Set(outside)].sort();
  }

  const resourceModels = Object.fromEntries(
    results
      .filter((r) => r.result.resourceModel)
      .map((r) => [r.subject.element, r.result.resourceModel!]),
  );
  const acceptance = acceptanceFiles(options.fixedAcceptance ?? [], resourceModels);
  // A supplied fixed suite set must account for every case the design declares.
  if (options.fixedAcceptance?.length) {
    const uncovered = acceptanceCaseCoverageProblems(resourceModels, acceptance.registrations);
    if (uncovered.length)
      throw new GenerationError(`Fixed acceptance is incomplete:\n${uncovered.join("\n")}`);
  }

  const summaries: SubjectSummary[] = results.map(({ subject }) => ({
    ...subject,
    module: templates.module(parseRef(subject.template)),
  }));
  const docs = [
    designFile(design),
    agentsFile(design, elements, options.projectName, {
      resourceModels,
      fixedAcceptance: acceptance.registrations,
    }),
    ...elements.map((element) => elementNotesFile(design, element, summaries)),
    ...rootScaffoldFiles(options.projectName),
  ];
  for (const file of docs) add(file, "jeeves");

  for (const file of acceptance.files) add(file, "fixed acceptance");
  const plan: ProjectPlan = {
    ...(acceptance.registrations.length && { fixedAcceptance: acceptance.registrations }),
    ...(Object.keys(resourceModels).length && {
      resourceModels,
      resourceStores: Object.fromEntries(
        Object.entries(resourceModels).map(([id, model]) => {
          const connection = design.connections.find((c) => c.id === model.storeConnection);
          if (!connection)
            throw new GenerationError(
              `${id}: resource store connection ${model.storeConnection ?? "(missing)"} is not in the design`,
            );
          return [id, { connection: connection.id, database: connection.to.element }];
        }),
      ),
    }),
    files: [...files.values()].sort((a, b) => (a.path < b.path ? -1 : 1)),
    compose,
    packageEdits: packageEdits(results, elements, runtimes),
    runtimes: [...runtimes.values()].sort((a, b) => (a.name < b.name ? -1 : 1)),
    elements,
    templates: [...used].sort(),
    subjects: results.map((r) => r.subject),
  };
  return recipe ? applyRecipe(plan, design, recipe) : plan;
}

function parseRef(ref: string): { id: string; version: string } {
  const at = ref.lastIndexOf("@");
  return { id: ref.slice(0, at), version: ref.slice(at + 1) };
}

function packageEdits(
  results: { result: GenerateResult }[],
  elements: PlannedElement[],
  runtimes: Map<string, RuntimePackage>,
): PackageEdit[] {
  const edits = new Map<string, PackageEdit>();
  const editFor = (id: string) => {
    let edit = edits.get(id);
    if (!edit) {
      const element = elements.find((e) => e.id === id);
      if (!element) throw new GenerationError(`A template named unknown element "${id}"`);
      edit = { element: id, path: `${element.dir}/package.json`, dependencies: [], scripts: [] };
      edits.set(id, edit);
    }
    return edit;
  };
  for (const { result } of results) {
    for (const dep of result.runtimeDependencies) {
      const runtime = runtimes.get(dep.name);
      if (!runtime) throw new GenerationError(`No template in this design ships ${dep.name}`);
      const edit = editFor(dep.element);
      edit.dependencies.push({
        name: dep.name,
        spec: vendoredRuntimeSpec(
          edit.path.replace(/\/package\.json$/, ""),
          dep.name,
          runtime.version,
        ),
      });
    }
    for (const dep of result.packageDependencies ?? []) {
      editFor(dep.element).dependencies.push({
        name: dep.name,
        spec: dep.version,
        ...(dep.dev && { dev: true }),
      });
    }
    for (const script of result.packageScripts ?? []) {
      editFor(script.element).scripts.push({ name: script.name, command: script.command });
    }
  }
  return [...edits.values()].sort((a, b) => (a.path < b.path ? -1 : 1));
}

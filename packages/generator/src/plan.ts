import { type DesignDocument, formatTemplateRef } from "@jeeves/spec";
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
  agentsFile,
  designFile,
  elementNotesFile,
  rootScaffoldFiles,
  type SubjectSummary,
} from "./documents.ts";
import type { TemplateSet } from "./modules.ts";

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
  /** Used for the root `package.json` name and the docs; the design has no name of its own. */
  projectName: string;
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
  const results: { subject: Subject; result: GenerateResult }[] = [];
  const elements: PlannedElement[] = [];
  const runtimes = new Map<string, RuntimePackage>();
  const used = new Set<string>();

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
      const subject: Subject = {
        element: element.id,
        ...(target.attachment !== undefined && { attachment: target.attachment }),
        template: formatTemplateRef(target.ref),
      };
      results.push({ subject, result: module.generate(ctx) });
    }
  }

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

  const summaries: SubjectSummary[] = results.map(({ subject }) => ({
    ...subject,
    module: templates.module(parseRef(subject.template)),
  }));
  const docs = [
    designFile(design),
    agentsFile(design, elements, options.projectName),
    ...elements.map((element) => elementNotesFile(design, element, summaries)),
    ...rootScaffoldFiles(options.projectName),
  ];
  for (const file of docs) add(file, "jeeves");

  return {
    files: [...files.values()].sort((a, b) => (a.path < b.path ? -1 : 1)),
    compose,
    packageEdits: packageEdits(results, elements, runtimes),
    runtimes: [...runtimes.values()].sort((a, b) => (a.name < b.name ? -1 : 1)),
    elements,
    templates: [...used].sort(),
    subjects: results.map((r) => r.subject),
  };
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

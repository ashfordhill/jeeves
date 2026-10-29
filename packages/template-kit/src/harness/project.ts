import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { type DesignDocument, formatTemplateRef, type TemplateLookup } from "@jeeves/spec";
import {
  type ComposeFile,
  type ComposeFragment,
  type ComposeService,
  composeToYaml,
  mergeCompose,
} from "../compose.ts";
import { createGenerateContext, elementDir } from "../context.ts";
import type { GenerateResult, OutputFile, RuntimePackage, TemplateModule } from "../contract.ts";
import {
  type DependencyEntry,
  mergePackageDependencies,
  mergePackageScripts,
  runtimeTarballName,
  VENDOR_DIR,
  vendoredRuntimeSpec,
} from "../packages.ts";

export interface BuildProjectOptions {
  dir: string;
  design: DesignDocument;
  lookup: TemplateLookup;
  /** Templates that can generate. Elements using other templates need a stub. */
  modules: TemplateModule[];
  /**
   * Compose services standing in for whole elements (attachments included) whose templates
   * aren't built yet, keyed by element ID. Other templates' fragments merge into them.
   */
  stubs?: Record<string, ComposeService>;
}

export interface BuiltProject {
  dir: string;
  compose: ComposeFile;
  /** Generation results by element ID, then attachment ID (`<element>/<attachment>`). */
  results: Map<string, GenerateResult>;
  /** Paths written by this build; scaffold files that already existed are left alone. */
  written: string[];
}

/**
 * A minimal generator for conformance tests: runs each template's `generate`, writes the files
 * (scaffold files only when missing), adds missing runtime and package dependencies to each
 * element's `package.json`, and merges compose fragments into `docker-compose.yml`. Runtime
 * tarballs come from `vendorRuntimes`. The real generator (S10) adds the lock file and ownership
 * drift checks.
 */
export function buildProject(options: BuildProjectOptions): BuiltProject {
  const { design, lookup, dir } = options;
  const stubs = options.stubs ?? {};
  const moduleFor = (ref: { id: string; version: string }) =>
    options.modules.find((m) => m.manifest.id === ref.id && m.manifest.version === ref.version);

  const results = new Map<string, GenerateResult>();
  const fragments: ComposeFragment[] = [];
  for (const element of design.elements) {
    if (!element.template) continue;
    const stub = stubs[element.id];
    if (stub) {
      fragments.push({ services: { [element.id]: stub } });
      continue;
    }
    const targets = [
      { ref: element.template, attachment: undefined as string | undefined, key: element.id },
      ...element.attachments.map((a) => ({
        ref: a.template,
        attachment: a.id,
        key: `${element.id}/${a.id}`,
      })),
    ];
    for (const target of targets) {
      const module = moduleFor(target.ref);
      if (!module) {
        throw new Error(
          `No template module for ${formatTemplateRef(target.ref)} (${target.key}); pass a stub`,
        );
      }
      const result = module.generate(
        createGenerateContext(design, lookup, element.id, target.attachment),
      );
      results.set(target.key, result);
      fragments.push(result.compose);
    }
  }

  const compose = mergeCompose(fragments);
  const files: OutputFile[] = [...results.values()].flatMap((r) => r.files);
  files.push({
    path: "docker-compose.yml",
    contents: composeToYaml(compose),
    ownership: "generated",
  });
  const written = writeProjectFiles(dir, files);
  written.push(...addElementDependencies(options, results));
  return { dir, compose, results, written };
}

/**
 * Adds each element's runtime and package dependencies and package scripts to its `package.json`
 * (which a template scaffolds). Runtime versions come from the modules that ship them.
 */
function addElementDependencies(
  options: BuildProjectOptions,
  results: Map<string, GenerateResult>,
): string[] {
  const runtimes = new Map<string, RuntimePackage>();
  for (const module of options.modules) {
    if (module.runtime) runtimes.set(module.runtime.name, module.runtime);
  }
  const byElement = new Map<string, DependencyEntry[]>();
  const scripts = new Map<string, { name: string; command: string }[]>();
  const add = (element: string, entry: DependencyEntry) =>
    byElement.set(element, [...(byElement.get(element) ?? []), entry]);
  for (const result of results.values()) {
    for (const dep of result.runtimeDependencies) {
      const runtime = runtimes.get(dep.name);
      if (!runtime) throw new Error(`No template module ships the runtime ${dep.name}`);
      const dir = dirOfElement(options, dep.element);
      add(dep.element, {
        name: dep.name,
        spec: vendoredRuntimeSpec(dir, dep.name, runtime.version),
      });
    }
    for (const dep of result.packageDependencies ?? []) {
      add(dep.element, { name: dep.name, spec: dep.version, ...(dep.dev && { dev: true }) });
    }
    for (const script of result.packageScripts ?? []) {
      if (!byElement.has(script.element)) byElement.set(script.element, []);
      scripts.set(script.element, [...(scripts.get(script.element) ?? []), script]);
    }
  }
  const written: string[] = [];
  for (const [element, entries] of byElement) {
    // A stub is a stand-in container, not a package.
    if (options.stubs?.[element]) continue;
    const path = `${dirOfElement(options, element)}/package.json`;
    const file = join(options.dir, path);
    if (!existsSync(file)) throw new Error(`${element} has dependencies but no ${path}`);
    const text = readFileSync(file, "utf8");
    const merged = mergePackageScripts(
      mergePackageDependencies(text, entries),
      scripts.get(element) ?? [],
    );
    if (merged !== text) {
      writeFileSync(file, merged);
      written.push(path);
    }
  }
  return written;
}

function dirOfElement(options: BuildProjectOptions, id: string): string {
  const element = options.design.elements.find((e) => e.id === id);
  const manifest = element?.template ? options.lookup.get(element.template) : undefined;
  if (manifest?.kind !== "element") throw new Error(`"${id}" is not a templated element`);
  return elementDir(manifest.elementKind, id);
}

/**
 * Packs each module's runtime with `pnpm pack` (its `prepack` builds `dist/`) into the project's
 * `vendor/jeeves/`, where generated `package.json` files point with `file:` specs.
 */
export function vendorRuntimes(dir: string, modules: TemplateModule[]): string[] {
  const destination = join(dir, VENDOR_DIR);
  mkdirSync(destination, { recursive: true });
  const seen = new Set<string>();
  const paths: string[] = [];
  for (const { runtime } of modules) {
    if (!runtime || seen.has(runtime.name)) continue;
    seen.add(runtime.name);
    execFileSync(
      pnpmCommand[0],
      [...pnpmCommand.slice(1), "pack", "--pack-destination", destination],
      {
        cwd: runtime.dir,
        stdio: "pipe",
      },
    );
    paths.push(`${VENDOR_DIR}/${runtimeTarballName(runtime.name, runtime.version)}`);
  }
  return paths;
}

/**
 * pnpm as the running script was started with (`pnpm test:templates`), else from PATH. pnpm 12's
 * `npm_execpath` is a native binary; older versions point at a JavaScript file.
 */
const execPath = process.env.npm_execpath;
const pnpmCommand: [string, ...string[]] = !execPath?.includes("pnpm")
  ? ["pnpm"]
  : /\.[cm]?js$/.test(execPath)
    ? [process.execPath, execPath]
    : [execPath];

/** Writes generated files always and scaffold files only if missing; returns written paths. */
export function writeProjectFiles(dir: string, files: OutputFile[]): string[] {
  const written: string[] = [];
  for (const file of files) {
    const path = join(dir, file.path);
    if (file.ownership === "scaffold" && existsSync(path)) continue;
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, file.contents);
    written.push(file.path);
  }
  return written;
}

import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { type DesignDocument, formatTemplateRef, type TemplateLookup } from "@jeeves/spec";
import {
  type ComposeFile,
  type ComposeFragment,
  type ComposeService,
  composeToYaml,
  mergeCompose,
} from "../compose.ts";
import { createGenerateContext } from "../context.ts";
import type { GenerateResult, OutputFile, TemplateModule } from "../contract.ts";

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
 * (scaffold files only when missing), and merges compose fragments into `docker-compose.yml`.
 * The real generator (S10) adds the lock file, ownership drift checks, and vendoring.
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
  return { dir, compose, results, written: writeProjectFiles(dir, files) };
}

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

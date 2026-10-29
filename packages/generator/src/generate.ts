import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import type { DesignDocument } from "@jeeves/spec";
import {
  mergePackageDependencies,
  mergePackageScripts,
  type RuntimePackage,
  runtimeTarballName,
  VENDOR_DIR,
} from "@jeeves/template-kit";
import { LOCK_PATH } from "./documents.ts";
import { pnpmCommand, runCommand } from "./exec.ts";
import { hashContents, type Lock, lockFor, lockToJson, readLock } from "./lock.ts";
import { type TemplateSet, templateSet } from "./modules.ts";
import { type PlannedElement, type ProjectPlan, planProject } from "./plan.ts";

/** Packs runtimes into `<dir>/vendor/jeeves/`; returns the paths it wrote (changed tarballs). */
export type Vendor = (dir: string, runtimes: RuntimePackage[]) => Promise<string[]>;

export interface GenerateProjectOptions {
  /** Absolute output directory; created if missing. */
  dir: string;
  design: DesignDocument;
  projectName: string;
  templates?: TemplateSet;
  /** Defaults to `pnpm pack` per runtime (`packRuntimes`). */
  vendor?: Vendor;
  /** `git init` and commit when the directory isn't in a repository yet. Default true. */
  git?: boolean;
  log?: (line: string) => void;
}

/** A reason regeneration stopped before writing anything. */
export interface OwnershipProblem {
  path: string;
  kind: "edited" | "unmanaged";
  message: string;
}

export type GenerateProjectResult =
  | {
      ok: true;
      plan: ProjectPlan;
      lock: Lock;
      /** Generated-owned files whose contents changed (or are new). */
      written: string[];
      /** Scaffold files written because they didn't exist yet. */
      scaffolded: string[];
      /** Scaffold files left alone because the project already has them. */
      kept: string[];
      /** Project-owned `package.json` files that got missing dependencies or scripts. */
      packages: string[];
      vendored: string[];
      /** Elements in the previous lock that are no longer in the design; never deleted. */
      removedElements: PlannedElement[];
      /** Files Jeeves generated before but no longer does; left in place. */
      orphaned: string[];
      git: "initialized" | "existing" | "disabled";
      firstGeneration: boolean;
    }
  | { ok: false; reason: "ownership"; problems: OwnershipProblem[] };

/**
 * Writes a template project for a design (PLAN §9): generated-owned files always, scaffold files
 * only when missing, missing dependencies into each element's `package.json`, vendored runtime
 * tarballs, and `jeeves/lock.json`. If a generated-owned file was edited by hand, or a file
 * Jeeves would generate already exists with other contents, nothing is written and the problems
 * are returned.
 */
export async function generateProject(
  options: GenerateProjectOptions,
): Promise<GenerateProjectResult> {
  const { dir, design } = options;
  const log = options.log ?? (() => {});
  const templates = options.templates ?? templateSet();
  const plan = planProject(design, templates, { projectName: options.projectName });
  const previous = readLock(dir);

  const problems = ownershipProblems(dir, plan, previous);
  if (problems.length > 0) return { ok: false, reason: "ownership", problems };

  mkdirSync(dir, { recursive: true });
  log(`Vendoring ${plan.runtimes.length} runtime package(s) into ${VENDOR_DIR}/`);
  const vendored = await (options.vendor ?? packRuntimes)(dir, plan.runtimes);

  const written: string[] = [];
  const scaffolded: string[] = [];
  const kept: string[] = [];
  for (const file of plan.files) {
    const path = join(dir, file.path);
    const exists = existsSync(path);
    if (file.ownership === "scaffold") {
      if (exists) {
        kept.push(file.path);
        continue;
      }
      scaffolded.push(file.path);
    } else {
      if (exists && readFileSync(path, "utf8") === file.contents) continue;
      written.push(file.path);
    }
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, file.contents);
  }

  const packages: string[] = [];
  for (const edit of plan.packageEdits) {
    const path = join(dir, edit.path);
    if (!existsSync(path)) {
      throw new Error(`${edit.element} needs dependencies, but ${edit.path} doesn't exist`);
    }
    const text = readFileSync(path, "utf8");
    const merged = mergePackageScripts(
      mergePackageDependencies(text, edit.dependencies),
      edit.scripts,
    );
    if (merged !== text) {
      writeFileSync(path, merged);
      packages.push(edit.path);
    }
  }

  const lock = lockFor(plan, design.revision);
  writeFileSync(join(dir, LOCK_PATH), lockToJson(lock));

  const planned = new Set(plan.elements.map((e) => e.id));
  const removedElements = (previous?.elements ?? []).filter((e) => !planned.has(e.id));
  const orphaned = Object.keys(previous?.files ?? {}).filter((path) => !(path in lock.files));
  for (const element of removedElements) {
    log(`${element.id} is no longer in the design; ${element.dir}/ was left in place`);
  }

  let git: "initialized" | "existing" | "disabled" = "disabled";
  if (options.git !== false) {
    git = (await initRepository(
      dir,
      `Generate template project from design revision ${design.revision}`,
    ))
      ? "initialized"
      : "existing";
    if (git === "initialized") log("Initialized a git repository with the generated project");
  }

  return {
    ok: true,
    plan,
    lock,
    written,
    scaffolded,
    kept,
    packages,
    vendored,
    removedElements,
    orphaned,
    git,
    firstGeneration: previous === undefined,
  };
}

/** Hand-edited generated-owned files, and files Jeeves would generate that it didn't write. */
export function ownershipProblems(
  dir: string,
  plan: ProjectPlan,
  previous: Lock | undefined,
): OwnershipProblem[] {
  const problems: OwnershipProblem[] = [];
  const owned = previous?.files ?? {};
  for (const [path, hash] of Object.entries(owned)) {
    const file = join(dir, path);
    // A deleted generated-owned file is simply generated again.
    if (!existsSync(file)) continue;
    if (hashContents(readFileSync(file)) !== hash) {
      problems.push({
        path,
        kind: "edited",
        message: `${path} was changed by hand since Jeeves generated it. Move the change into a project-owned file (or into the design), then restore the file, for example with \`git checkout -- ${path}\`.`,
      });
    }
  }
  for (const file of plan.files) {
    if (file.ownership !== "generated" || file.path in owned) continue;
    const path = join(dir, file.path);
    if (existsSync(path) && readFileSync(path, "utf8") !== file.contents) {
      problems.push({
        path: file.path,
        kind: "unmanaged",
        message: `${file.path} already exists and Jeeves didn't generate it. Move or delete it, or pick another output folder.`,
      });
    }
  }
  return problems.sort((a, b) => (a.path < b.path ? -1 : 1));
}

/**
 * Packs each runtime with `pnpm pack` (its `prepack` builds `dist/`) and copies the tarball into
 * `vendor/jeeves/` when it differs from the one there. Packing is deterministic, so an unchanged
 * runtime leaves the project's tarball (and git) alone.
 */
export const packRuntimes: Vendor = async (dir, runtimes) => {
  const destination = join(dir, VENDOR_DIR);
  mkdirSync(destination, { recursive: true });
  const scratch = mkdtempSync(join(tmpdir(), "jeeves-pack-"));
  const [pnpm, ...pnpmArgs] = pnpmCommand();
  const written: string[] = [];
  try {
    for (const runtime of runtimes) {
      const result = await runCommand(pnpm, [...pnpmArgs, "pack", "--pack-destination", scratch], {
        cwd: runtime.dir,
      });
      if (result.exitCode !== 0) {
        throw new Error(`pnpm pack failed for ${runtime.name}:\n${result.output.slice(-4000)}`);
      }
      const name = runtimeTarballName(runtime.name, runtime.version);
      const packed = readFileSync(join(scratch, name));
      const target = join(destination, name);
      if (existsSync(target) && readFileSync(target).equals(packed)) continue;
      writeFileSync(target, packed);
      written.push(`${VENDOR_DIR}/${name}`);
    }
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }
  return written;
};

/**
 * `git init` plus an initial commit, unless `dir` is already inside a work tree. Returns whether
 * it created the repository.
 */
export async function initRepository(dir: string, message: string): Promise<boolean> {
  const inside = await runCommand("git", ["rev-parse", "--is-inside-work-tree"], { cwd: dir });
  if (inside.exitCode === 0) return false;
  const git = async (...args: string[]) => {
    const result = await runCommand("git", args, { cwd: dir });
    if (result.exitCode !== 0) throw new Error(`git ${args[0]} failed: ${result.output.trim()}`);
    return result.output.trim();
  };
  await git("init", "--quiet", "--initial-branch=main");
  await git("add", "--all");
  // Use the person's git identity when they have one; otherwise commit as Jeeves.
  const named = await runCommand("git", ["config", "user.email"], { cwd: dir });
  const identity =
    named.exitCode === 0 && named.output.trim()
      ? []
      : ["-c", "user.name=Jeeves", "-c", "user.email=jeeves@localhost"];
  await git(...identity, "commit", "--quiet", "--no-verify", "-m", message);
  return true;
}

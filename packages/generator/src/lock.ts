import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  deliveryModelSchema,
  localHttpPoolBindingSchema,
  resourceConfigSchema,
  workspaceBindingSchema,
} from "@jeeves/spec";
import { runtimeTarballName, VENDOR_DIR } from "@jeeves/template-kit";
import { z } from "zod";
import { acceptanceRegistrationSchema } from "./acceptance.ts";
import { LOCK_PATH } from "./documents.ts";
import { GENERATOR_VERSION, type ProjectPlan } from "./plan.ts";

/**
 * `jeeves/lock.json` (PLAN §9): what generated the project and which files Jeeves owns. It has no
 * timestamps, so the same design and templates give the same lock.
 */
export const lockSchema = z.object({
  lockVersion: z.literal(1),
  httpPools: z.record(z.string(), localHttpPoolBindingSchema).optional(),
  poolSourceHashes: z.record(z.string(), z.record(z.string(), z.string())).optional(),
  recipe: z
    .object({
      id: z.string(),
      version: z.string(),
      manifestSha256: z.string().regex(/^[a-f0-9]{64}$/),
    })
    .optional(),
  fixedAcceptance: z.array(acceptanceRegistrationSchema).optional(),
  resourceFingerprints: z.record(z.string(), z.string()).optional(),
  resourceStores: z
    .record(z.string(), z.object({ connection: z.string(), database: z.string() }))
    .optional(),
  frozenDependencies: z.record(z.string(), z.record(z.string(), z.string())).optional(),
  deliveryModels: z.record(z.string(), deliveryModelSchema).optional(),
  workspaceBindings: z.record(z.string(), workspaceBindingSchema).optional(),
  resourceModels: z.record(z.string(), resourceConfigSchema).optional(),
  generator: z.string(),
  designRevision: z.int().nonnegative(),
  templates: z.array(z.string()),
  runtimes: z.array(z.object({ name: z.string(), version: z.string(), tarball: z.string() })),
  elements: z.array(
    z.object({
      id: z.string(),
      template: z.string(),
      dir: z.string(),
      ownedPaths: z.array(z.string()),
    }),
  ),
  /** Generated-owned files and the SHA-256 of their contents. */
  files: z.record(z.string(), z.string()),
});
export type Lock = z.infer<typeof lockSchema>;

export class LockError extends Error {}

export function hashContents(contents: string | Buffer): string {
  return `sha256-${createHash("sha256").update(contents).digest("hex")}`;
}

export function lockFor(plan: ProjectPlan, designRevision: number): Lock {
  return {
    lockVersion: 1,
    ...(plan.httpPools && { httpPools: plan.httpPools, poolSourceHashes: plan.poolSourceHashes }),
    ...(plan.recipe && { recipe: plan.recipe }),
    ...(plan.fixedAcceptance && { fixedAcceptance: plan.fixedAcceptance }),
    ...(plan.resourceModels && {
      resourceModels: plan.resourceModels,
      resourceStores: plan.resourceStores,
      resourceFingerprints: Object.fromEntries(
        Object.entries(plan.resourceModels).map(([id, model]) => [
          id,
          hashContents(JSON.stringify(model.resources)).replace("sha256-", ""),
        ]),
      ),
    }),
    ...(plan.deliveryModels && { deliveryModels: plan.deliveryModels }),
    ...(plan.workspaceBindings && { workspaceBindings: plan.workspaceBindings }),
    ...(plan.frozenDependencies && { frozenDependencies: plan.frozenDependencies }),
    generator: GENERATOR_VERSION,
    designRevision,
    templates: plan.templates,
    runtimes: plan.runtimes.map((r) => ({
      name: r.name,
      version: r.version,
      tarball: `${VENDOR_DIR}/${runtimeTarballName(r.name, r.version)}`,
    })),
    elements: plan.elements,
    files: Object.fromEntries([
      ...plan.files
        .filter((f) => f.ownership === "generated")
        .map((f) => [f.path, hashContents(f.contents)]),
      ...(plan.artifacts ?? []).map((file) => [file.path, hashContents(file.contents)]),
    ]),
  };
}

export function lockToJson(lock: Lock): string {
  return `${JSON.stringify(lock, null, 2)}\n`;
}

/** The project's lock, or `undefined` for a project Jeeves hasn't generated yet. */
export function readLock(dir: string): Lock | undefined {
  const path = join(dir, LOCK_PATH);
  if (!existsSync(path)) return undefined;
  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(path, "utf8"));
  } catch (error) {
    throw new LockError(`${LOCK_PATH} isn't valid JSON: ${(error as Error).message}`);
  }
  const parsed = lockSchema.safeParse(raw);
  if (!parsed.success) {
    throw new LockError(`${LOCK_PATH} isn't a Jeeves lock: ${z.prettifyError(parsed.error)}`);
  }
  return parsed.data;
}

/** A project-owned package may add libraries, but cannot replace a released component binding. */
export function assertFrozenDependencies(
  dir: string,
  requirements: Record<string, Record<string, string>> = {},
  requirePresent = true,
): void {
  for (const [path, dependencies] of Object.entries(requirements)) {
    const file = join(dir, path);
    if (!existsSync(file) && !requirePresent) continue;
    const pkg = JSON.parse(readFileSync(file, "utf8")) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
      optionalDependencies?: Record<string, string>;
    };
    for (const [name, spec] of Object.entries(dependencies)) {
      const value = pkg.dependencies?.[name];
      if (
        !requirePresent &&
        value === undefined &&
        !pkg.devDependencies?.[name] &&
        !pkg.optionalDependencies?.[name]
      )
        continue;
      if (
        value !== spec ||
        pkg.devDependencies?.[name] !== undefined ||
        pkg.optionalDependencies?.[name] !== undefined
      )
        throw new LockError(`${path}: ${name} must keep the pinned production dependency ${spec}`);
    }
  }
}

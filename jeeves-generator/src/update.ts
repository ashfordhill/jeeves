import { execFile } from "node:child_process";
import { randomBytes } from "node:crypto";
import { constants, type Stats } from "node:fs";
import {
  cp,
  lstat,
  mkdir,
  mkdtemp,
  open,
  readdir,
  realpath,
  rename,
  rm,
  rmdir,
  symlink,
  unlink,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, isAbsolute, join, resolve } from "node:path";
import { promisify } from "node:util";
import type { NormalizedGeneration } from "@jeeves/spec";
import { generationLocalIdentity } from "@jeeves/spec";
import { assertDistinctPaths } from "./files.ts";
import { sha256 } from "./json.ts";
import type { assembleV2 } from "./v2/assemble.ts";

export type UpdateActionKind =
  // generated files
  | "create"
  | "replace"
  | "unchanged"
  // the application's own files
  | "keep"
  | "keep-changed"
  // a generated file the application declared as its own
  | "override"
  // files the new export no longer has
  | "remove"
  | "orphan"
  // a generated file edited by hand: refuses the update
  | "edited";
export type UpdateAction = { path: string; action: UpdateActionKind };
export type ManifestFile = { path: string; sha256: string; ownership: string };

/** Hook files, stub bodies and product SQL; every other ownership is generated. */
const extension = "generated-extension";
const compare = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

/**
 * Decides, file by file, what regenerating into an existing export does. It never deletes,
 * overwrites or takes over a file the application owns, and a shadow under `.jeeves/generated/`
 * stays until the application's file equals the new bytes or the application deletes it. It
 * reads nothing from disk and writes nothing.
 */
export function planUpdate(input: {
  /** The new export's files, each with its ownership from the new manifest. */
  next: readonly ManifestFile[];
  /** The files of the manifest already in the directory. */
  previous: readonly ManifestFile[];
  /** SHA-256 of each file now on disk, for every path in `next`, `previous` or `overrides` that exists. */
  disk: ReadonlyMap<string, string>;
  /** Generated paths the application keeps as its own (`.jeeves/overrides.json`). */
  overrides: readonly string[];
  /** Paths that already have a file under `.jeeves/generated/` from an earlier update. */
  pendingShadows: readonly string[];
}): { actions: UpdateAction[]; refused: string[]; shadows: string[] } {
  const next = new Map(input.next.map((file) => [file.path, file]));
  const previous = new Map(input.previous.map((file) => [file.path, file]));
  const overrides = new Set(input.overrides);
  const pending = new Set(input.pendingShadows);
  const actions: UpdateAction[] = [];
  const ownershipChanged = new Set<string>();
  const unknownOverrides: string[] = [];
  const add = (path: string, action: UpdateActionKind) => actions.push({ path, action });

  for (const [path, file] of next) {
    const onDisk = input.disk.get(path);
    const before = previous.get(path);
    if (file.ownership !== extension) {
      // An application's file never becomes generated.
      if (before?.ownership === extension) {
        ownershipChanged.add(path);
        add(path, "edited");
      } else if (overrides.has(path)) add(path, "override");
      else if (onDisk === undefined) add(path, "create");
      // An unknown file is in the way, even with the same bytes.
      else if (before === undefined) add(path, "edited");
      else if (onDisk === file.sha256) add(path, "unchanged");
      else if (onDisk === before.sha256) add(path, "replace");
      else add(path, "edited");
    } else if (onDisk === undefined) add(path, "create");
    else if (onDisk === file.sha256) add(path, "unchanged");
    else if (before?.sha256 === file.sha256 && !pending.has(path)) add(path, "keep");
    else add(path, "keep-changed");
  }

  for (const [path, file] of previous) {
    if (next.has(path)) continue;
    const onDisk = input.disk.get(path);
    if (onDisk === undefined) continue;
    if (overrides.has(path) || file.ownership === extension) add(path, "orphan");
    else if (onDisk === file.sha256) add(path, "remove");
    else add(path, "edited");
  }

  for (const path of overrides) {
    if (next.has(path) || previous.has(path)) continue;
    // An override the export dropped earlier is still the application's.
    if (input.disk.get(path) !== undefined) add(path, "orphan");
    else unknownOverrides.push(path);
  }

  actions.sort((a, b) => compare(a.path, b.path));
  const refused = [
    ...actions
      .filter(({ action }) => action === "edited")
      .map(({ path }) => (ownershipChanged.has(path) ? `ownership changed: ${path}` : path)),
    ...unknownOverrides.sort(compare).map((path) => `unknown override: ${path}`),
  ];
  const shadows = actions
    .filter(({ action }) => action === "override" || action === "keep-changed")
    .map(({ path }) => path);
  return { actions, refused, shadows };
}

const manifestPath = ".jeeves/manifest.json";
const overridesPath = ".jeeves/overrides.json";
const shadowRoot = ".jeeves/generated";
const ownerships = new Set(["generated-scaffold", "generated-extension", "generator-metadata"]);
const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const failure = (message: string, cause?: unknown) =>
  new Error(message, cause === undefined ? undefined : { cause });
const unsafe = (path: string) => failure(`Unsafe update path: ${path}`);
const missing = (error: unknown) => (error as NodeJS.ErrnoException).code === "ENOENT";

export type UpdateResult = {
  directory: string;
  check: boolean;
  refused: string[];
  counts: { create: number; replace: number; unchanged: number; keep: number };
  keepChanged: string[];
  override: string[];
  remove: string[];
  orphan: string[];
};

/** Reads a regular file without following a symlink in its last segment. */
async function readRegular(path: string) {
  const handle = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    if (!(await handle.stat()).isFile()) throw new Error(`Not a regular file: ${path}`);
    return await handle.readFile();
  } finally {
    await handle.close();
  }
}

/** The export's root and its manifest's files, or `Not a Jeeves v2 export`. */
async function exportManifest(directory: string) {
  const notAnExport = (cause?: unknown) => failure(`Not a Jeeves v2 export: ${directory}`, cause);
  if (!isAbsolute(directory)) throw notAnExport();
  const root = resolve(directory);
  let manifest: unknown;
  try {
    const info = await lstat(root);
    const metadata = await lstat(join(root, ".jeeves"));
    const real = info.isDirectory() && (await realpath(root)) === root;
    if (real && !metadata.isSymbolicLink() && metadata.isDirectory())
      manifest = JSON.parse(new TextDecoder().decode(await readRegular(join(root, manifestPath))));
  } catch (error) {
    throw notAnExport(error);
  }
  if (!isRecord(manifest) || manifest.format !== "jeeves-v2-manifest-v1") throw notAnExport();
  return { root, manifest };
}

function previousFiles(manifest: Record<string, unknown>): ManifestFile[] {
  const invalid = (cause?: unknown) => failure("Invalid .jeeves/manifest.json", cause);
  if (!Array.isArray(manifest.files)) throw invalid();
  const files = manifest.files.map((record: unknown) => {
    if (
      !isRecord(record) ||
      typeof record.path !== "string" ||
      typeof record.sha256 !== "string" ||
      !/^[0-9a-f]{64}$/u.test(record.sha256) ||
      typeof record.ownership !== "string" ||
      !ownerships.has(record.ownership)
    )
      throw invalid();
    // The update writes these itself; the manifest never lists them.
    const lower = record.path.toLowerCase();
    if (
      lower === manifestPath ||
      lower === overridesPath ||
      lower === shadowRoot ||
      lower.startsWith(`${shadowRoot}/`)
    )
      throw invalid();
    return { path: record.path, sha256: record.sha256, ownership: record.ownership };
  });
  try {
    assertDistinctPaths(files.map((file) => file.path));
  } catch (error) {
    throw invalid(error);
  }
  return files;
}

/** Each path the lstat preflight has seen, inside the export's root: its entry, or null if absent. */
function inspector(root: string) {
  const seen = new Map<string, Stats | null>();
  const entry = async (path: string) => {
    if (!seen.has(path))
      seen.set(
        path,
        await lstat(join(root, path)).catch((error: unknown) => {
          if (missing(error)) return null;
          throw error;
        }),
      );
    return seen.get(path) ?? null;
  };
  /** The path's entry if it exists, refusing a symlink anywhere, a target that is not a regular
   * file and a parent that is not a directory. */
  return async (path: string) => {
    const parts = path.split("/");
    for (let end = 1; end < parts.length; end++) {
      const parent = await entry(parts.slice(0, end).join("/"));
      if (!parent) return null;
      if (parent.isSymbolicLink() || !parent.isDirectory()) throw unsafe(path);
    }
    const target = await entry(path);
    if (target && (target.isSymbolicLink() || !target.isFile())) throw unsafe(path);
    return target;
  };
}

async function readOverrides(root: string, inspect: ReturnType<typeof inspector>) {
  if (!(await inspect(overridesPath))) return [];
  const invalid = (cause?: unknown) => failure("Invalid .jeeves/overrides.json", cause);
  let value: unknown;
  try {
    value = JSON.parse(new TextDecoder().decode(await readRegular(join(root, overridesPath))));
  } catch (error) {
    throw invalid(error);
  }
  if (!isRecord(value) || !Array.isArray(value.overrides)) throw invalid();
  const paths = value.overrides.map((item: unknown) => {
    if (
      !isRecord(item) ||
      typeof item.path !== "string" ||
      typeof item.reason !== "string" ||
      item.reason === ""
    )
      throw invalid();
    const lower = item.path.toLowerCase();
    if (lower === ".jeeves" || lower.startsWith(".jeeves/")) throw invalid();
    return item.path;
  });
  try {
    assertDistinctPaths(paths);
  } catch (error) {
    throw invalid(error);
  }
  return paths;
}

/** Every file under `.jeeves/generated/`, as the application's path it shadows. */
async function pendingShadows(root: string) {
  const base = join(root, shadowRoot);
  const info = await lstat(base).catch((error: unknown) => {
    if (missing(error)) return null;
    throw error;
  });
  if (!info) return [];
  if (info.isSymbolicLink() || !info.isDirectory()) throw unsafe(shadowRoot);
  const found: string[] = [];
  const walk = async (relative: string) => {
    for (const item of await readdir(join(base, relative), { withFileTypes: true })) {
      const path = relative ? `${relative}/${item.name}` : item.name;
      if (item.isDirectory()) await walk(path);
      else found.push(path);
    }
  };
  await walk("");
  return found.sort(compare);
}

/** Removes the empty directories under `.jeeves/generated/`, and the folder itself once empty. */
async function pruneShadows(directory: string): Promise<boolean> {
  let empty = true;
  for (const item of await readdir(directory, { withFileTypes: true }))
    if (!item.isDirectory() || !(await pruneShadows(join(directory, item.name)))) empty = false;
  if (empty) await rmdir(directory);
  return empty;
}

async function makeParents(root: string, path: string) {
  const parts = path.split("/");
  parts.pop();
  let directory = root;
  for (const part of parts) {
    directory = join(directory, part);
    try {
      await mkdir(directory, { mode: 0o755 });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
    }
    const info = await lstat(directory);
    if (info.isSymbolicLink() || !info.isDirectory()) throw unsafe(path);
  }
}

/** Writes a temporary file beside the target and renames it over the target, so a stopped
 * update never leaves a half-written file. */
async function writeFileAtomically(root: string, path: string, bytes: Uint8Array, mode = 0o644) {
  await makeParents(root, path);
  const target = join(root, path);
  const temporary = join(
    dirname(target),
    `.${basename(target)}.${randomBytes(6).toString("hex")}.jeeves-update`,
  );
  const handle = await open(
    temporary,
    constants.O_CREAT | constants.O_EXCL | constants.O_WRONLY | constants.O_NOFOLLOW,
    0o600,
  );
  try {
    try {
      await handle.writeFile(bytes);
      await handle.chmod(mode);
      await handle.sync();
    } finally {
      await handle.close();
    }
    await rename(temporary, target);
  } catch (error) {
    await unlink(temporary).catch(() => {});
    throw error;
  }
}

/** Missing metadata denotes the pre-versioned, unrestricted API, not the saved design schema. */
function extensionVersion(manifest: Record<string, unknown>) {
  if (manifest.extensionApi === undefined) return 1;
  if (
    !isRecord(manifest.extensionApi) ||
    !Number.isSafeInteger(manifest.extensionApi.version) ||
    (manifest.extensionApi.version as number) < 1
  )
    throw failure("Invalid extension API version in .jeeves/manifest.json");
  return manifest.extensionApi.version as number;
}

/** Build the actual kept application against the new generated interfaces. No target bytes,
 * dependency install or old runtime need changing for validation. All scratch output is removed. */
async function validateMigration(
  root: string,
  bundle: ReturnType<typeof assembleV2>,
  actions: readonly UpdateAction[],
) {
  const stage = await mkdtemp(join(tmpdir(), "jeeves-extension-migration-"));
  try {
    // Keep untracked application source too (shared DTOs, product SQL, etc). Never copy runtime
    // state, dependency trees, credentials or repository internals into a migration build.
    const excluded = new Set([".git", ".jeeves", ".runtime", "node_modules", "dist"]);
    const copy = async (relative: string) => {
      for (const entry of await readdir(join(root, relative), { withFileTypes: true })) {
        if (excluded.has(entry.name) || entry.name === ".env" || entry.name.startsWith(".env."))
          continue;
        const path = relative ? `${relative}/${entry.name}` : entry.name;
        if (entry.isSymbolicLink()) throw unsafe(path);
        if (entry.isDirectory()) {
          await mkdir(join(stage, path), { recursive: true });
          await copy(path);
        } else if (entry.isFile()) await cp(join(root, path), join(stage, path));
        else throw unsafe(path);
      }
    };
    await copy("");
    const bytes = new Map(bundle.files.map((file) => [file.path, file.bytes]));
    for (const { path, action } of actions) {
      if (action === "remove") await unlink(join(stage, path));
      if (action === "create" || action === "replace") {
        const content = bytes.get(path);
        if (!content) throw failure(`The bundle has no bytes for ${path}`);
        await writeFileAtomically(stage, path, content);
      }
    }
    // Resolve installed dependencies without executing the application's editable build script.
    await symlink(join(root, "node_modules"), join(stage, "node_modules"), "dir");
    const compiler = join(root, "node_modules/typescript/bin/tsc");
    await promisify(execFile)(
      process.execPath,
      [compiler, "--noEmit", "--project", join(stage, "tsconfig.json")],
      { cwd: stage, timeout: 120000, maxBuffer: 1024 * 1024 },
    );
    if (bundle.files.some((file) => file.path === "scripts/check-extensions.mjs")) {
      // The scratch copy deliberately excludes prior .jeeves state. Restore every target
      // metadata payload, including unchanged records, before the complete-export hash check.
      for (const file of bundle.files)
        if (file.path.startsWith(".jeeves/") && file.path !== manifestPath)
          await writeFileAtomically(stage, file.path, file.bytes);
      await writeFileAtomically(
        stage,
        ".jeeves/manifest.json",
        Buffer.from(JSON.stringify(bundle.manifest)),
      );
      await promisify(execFile)(
        process.execPath,
        [join(stage, "scripts/check-extensions.mjs"), stage],
        {
          cwd: stage,
          timeout: 120000,
          maxBuffer: 1024 * 1024,
        },
      );
    }
  } finally {
    await rm(stage, { recursive: true, force: true });
  }
}

/** Existing stable targets and durable/handwritten namespaces cannot be re-keyed by regeneration.
 * Additions are safe; removal/replacement needs an application/data migration outside this updater. */
function runtimeIdentities(model: Partial<NormalizedGeneration>) {
  const records = new Map<string, string>();
  for (const process of model.processes ?? [])
    records.set(
      `process:${process.tile}`,
      JSON.stringify({ tile: process.tile, kind: process.kind }),
    );
  for (const selection of model.selections ?? []) {
    const module = selection.target.kind === "component" ? selection.target.component : undefined;
    records.set(
      `selection:${selection.id}`,
      JSON.stringify({
        host: selection.host,
        module,
        kind: selection.binding.kind,
      }),
    );
    for (const resource of selection.resources)
      records.set(
        `resource:${selection.id}.${resource.field}`,
        JSON.stringify({ element: resource.element, identity: resource.identity }),
      );
  }
  for (const process of model.processes ?? [])
    for (const writer of process.writers ?? []) {
      const state = model.productState?.find((item) => item.resource === writer.database);
      records.set(
        `product:${writer.database}.${writer.module}`,
        JSON.stringify({
          owner: state?.schema ? state.owner : undefined,
          schema: state?.schema ?? `m_${generationLocalIdentity(writer.module).sql}`,
        }),
      );
    }
  for (const capability of model.capabilities ?? [])
    records.set(
      `callable:${capability.id}`,
      JSON.stringify({
        module: capability.module,
        process: capability.process,
        owner: capability.owner,
        identity:
          capability.caller.kind === "verified-principal" ? capability.caller.identity : undefined,
        guard:
          capability.caller.kind === "verified-principal" ? capability.caller.guard : undefined,
      }),
    );
  return records;
}

/**
 * Regenerates an existing Jeeves v2 export in place from `bundle` (what `assembleV2` returns).
 * Generated files are rewritten and the application's own files kept, as `planUpdate` decides.
 * A refused update, a `check` and any unsafe path write nothing. It touches no file outside
 * the new and old manifests and the overrides, except `.jeeves/manifest.json` and files under
 * `.jeeves/generated/`.
 */
export async function updateDirectory(
  bundle: ReturnType<typeof assembleV2>,
  directory: string,
  options: { check: boolean; acknowledgeExtensionApi?: number },
): Promise<UpdateResult> {
  const { root, manifest } = await exportManifest(directory);
  const previous = previousFiles(manifest);
  const inspect = inspector(root);
  const overrides = await readOverrides(root, inspect);
  const pending = await pendingShadows(root);
  const next: ManifestFile[] = bundle.manifest.files.map(({ path, sha256, ownership }) => ({
    path,
    sha256,
    ownership,
  }));

  // Preflight: case collisions, and a file that would become a directory or the reverse.
  const paths = [...new Set([...next, ...previous].map((file) => file.path))];
  assertDistinctPaths(paths);
  const disk = new Map<string, string>();
  for (const path of new Set([...paths, ...overrides]))
    if (await inspect(path)) disk.set(path, sha256(await readRegular(join(root, path))));
  // Every shadow this update could write or delete, and the manifest it writes last.
  const shadowPaths = new Set([
    ...pending,
    ...overrides,
    ...next.filter((file) => file.ownership === extension).map((file) => file.path),
  ]);
  for (const path of shadowPaths) await inspect(`${shadowRoot}/${path}`);
  await inspect(manifestPath);

  const plan = planUpdate({ next, previous, disk, overrides, pendingShadows: pending });
  const named = (action: UpdateActionKind) =>
    plan.actions.filter((item) => item.action === action).map((item) => item.path);
  const result: UpdateResult = {
    directory: root,
    check: options.check,
    refused: plan.refused,
    counts: {
      create: named("create").length,
      replace: named("replace").length,
      unchanged: named("unchanged").length,
      keep: named("keep").length,
    },
    keepChanged: named("keep-changed"),
    override: named("override"),
    remove: named("remove"),
    orphan: named("orphan"),
  };
  const normalizedPath = ".jeeves/normalized.json";
  const oldRecord = previous.find((file) => file.path === normalizedPath);
  const nextNormalized = bundle.files.find((file) => file.path === normalizedPath);
  if (oldRecord && nextNormalized) {
    if (disk.get(normalizedPath) !== oldRecord.sha256)
      result.refused.push(
        `Cannot verify prior runtime identities: restore ${normalizedPath} from the previous export.`,
      );
    else {
      const oldModel = JSON.parse(
        new TextDecoder().decode(await readRegular(join(root, normalizedPath))),
      ) as Partial<NormalizedGeneration>;
      const nextModel = JSON.parse(
        new TextDecoder().decode(nextNormalized.bytes),
      ) as Partial<NormalizedGeneration>;
      const after = runtimeIdentities(nextModel);
      const changed = [...runtimeIdentities(oldModel)]
        .filter(([id, identity]) => after.get(id) !== identity)
        .map(([id]) => id);
      if (changed.length)
        result.refused.push(
          `Runtime identity/namespace migration required for ${changed.join(", ")}. Review ${normalizedPath} and application-owned hook paths (${result.orphan.join(", ") || "existing hooks"}); export to a fresh directory and migrate application/data explicitly. This updater cannot migrate identities; extension-API acknowledgement does not authorize it.`,
        );
    }
  }
  const beforeVersion = extensionVersion(manifest);
  const nextVersion = bundle.manifest.extensionApi.version;
  if (beforeVersion < 7 && nextVersion >= 7) {
    const legacy = previous.filter(
      (file) =>
        file.ownership === extension &&
        /^infra\/postgres\/[^/]+\/modules\/[^/]+\.sql$/.test(file.path) &&
        disk.has(file.path),
    );
    if (legacy.length) {
      try {
        const receipt = JSON.parse(
          new TextDecoder().decode(
            await readRegular(join(root, ".jeeves/product-sql-migration.json")),
          ),
        );
        if (
          !isRecord(receipt) ||
          receipt.version !== 1 ||
          receipt.mode !== "external-reviewed" ||
          !Array.isArray(receipt.legacy) ||
          receipt.legacy.length !== legacy.length ||
          legacy.some(
            (file) =>
              !(receipt.legacy as unknown[]).some(
                (row: unknown) =>
                  isRecord(row) && row.file === file.path && row.sha256 === disk.get(file.path),
              ),
          )
        )
          throw new Error("baseline receipt differs");
        for (const resource of new Set(legacy.map((file) => file.path.split("/")[2]))) {
          const declaration = JSON.parse(
            new TextDecoder().decode(
              await readRegular(join(root, `infra/postgres/${resource}/products.json`)),
            ),
          );
          if (
            !isRecord(declaration) ||
            declaration.version !== 1 ||
            !Array.isArray(declaration.namespaces) ||
            !declaration.namespaces.length
          )
            throw new Error("versioned declaration required");
          for (const namespace of declaration.namespaces) {
            if (
              !isRecord(namespace) ||
              !Array.isArray(namespace.migrations) ||
              !namespace.migrations.length
            )
              throw new Error("explicit baseline migration required");
            for (const migration of namespace.migrations) {
              if (
                !isRecord(migration) ||
                typeof migration.file !== "string" ||
                !/^infra\/postgres\/[^/]+\/products\/migrations\/[a-z0-9_]+\/[a-zA-Z0-9_-]+\.sql$/.test(
                  migration.file,
                )
              )
                throw new Error("explicit baseline migration required");
              await readRegular(join(root, migration.file));
            }
          }
        }
      } catch {
        result.refused.push(
          `Product SQL baseline/migration required for ${legacy.map((file) => file.path).join(", ")}. Supply reviewed products.json, ordered migration files and .jeeves/product-sql-migration.json (version 1, mode external-reviewed, legacy file/sha256 records). Perform database baseline/data migration externally; this updater never executes old SQL or converts schemas. Existing application bytes are preserved.`,
        );
      }
    }
  }
  const hooks = previous
    .filter(
      (file) =>
        file.ownership === extension &&
        /\.(?:[cm]?[jt]sx?)$/u.test(file.path) &&
        disk.has(file.path),
    )
    .map((file) => file.path)
    .sort(compare);
  if (beforeVersion !== nextVersion) {
    const instruction = `Extension API ${beforeVersion} -> ${nextVersion} requires migration; edit these files and acknowledge --ack-extension-api=${nextVersion}: ${hooks.join(", ")}`;
    if (options.acknowledgeExtensionApi !== nextVersion) result.refused.push(instruction);
    else if (overrides.length)
      result.refused.push(
        `Resolve generated overrides before extension migration: ${overrides.join(", ")}`,
      );
    else if (!result.refused.length) {
      try {
        await validateMigration(root, bundle, plan.actions);
      } catch (error) {
        const detail = error as {
          stdout?: string;
          stderr?: string;
          message?: string;
        };
        result.refused.push(
          `Extension migration build failed (${hooks.join(", ")}): ${detail.stdout || detail.stderr || detail.message}`,
        );
      }
    }
  } else if (
    options.acknowledgeExtensionApi !== undefined &&
    options.acknowledgeExtensionApi !== nextVersion
  )
    result.refused.push(
      `Acknowledge the target extension API version ${nextVersion}, not ${options.acknowledgeExtensionApi}.`,
    );
  if (result.refused.length || options.check) return result;

  const generated = new Map(bundle.files.map((file) => [file.path, file.bytes]));
  const bytesOf = (path: string) => {
    const bytes = generated.get(path);
    if (!bytes) throw new Error(`The bundle has no bytes for ${path}`);
    return bytes;
  };
  for (const { path, action } of plan.actions)
    if (action === "create") await writeFileAtomically(root, path, bytesOf(path));
    else if (action === "replace") {
      const existing = await inspect(path);
      await writeFileAtomically(root, path, bytesOf(path), (existing?.mode ?? 0o644) & 0o777);
    }
  for (const path of named("remove")) await unlink(join(root, path));
  for (const path of plan.shadows)
    await writeFileAtomically(root, `${shadowRoot}/${path}`, bytesOf(path));
  const kept = new Set(plan.shadows);
  for (const path of pending) if (!kept.has(path)) await unlink(join(root, shadowRoot, path));
  if (await lstat(join(root, shadowRoot)).catch(() => null))
    await pruneShadows(join(root, shadowRoot));
  await writeFileAtomically(root, manifestPath, bytesOf(manifestPath));
  return result;
}

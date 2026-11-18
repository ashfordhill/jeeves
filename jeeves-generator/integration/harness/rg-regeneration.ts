/** RG24 checkpoint infrastructure. Nothing here is copied into product hooks. */
import assert from "node:assert/strict";
import { cp, mkdir, mkdtemp, readdir, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, join } from "node:path";
import { gzipSync } from "node:zlib";
import { codeLines, sourceLocReport } from "../../src/source-loc.ts";
import type { UpdateResult } from "../../src/update.ts";
import type { Application } from "./application.ts";
import { inventory } from "./cleanup.ts";
import { command, hash, json, repository, writeJson } from "./process.ts";
import { diskHashes } from "./regeneration.ts";

export const adoptionFixture = join(
  repository,
  "field-projects/generator-system/fixtures/rg-regeneration",
);
export const oldFixture = join(repository, "field-projects/generator-system/fixtures/regeneration");
export const legacyRevision = "d524845";

/** Extract immutable Git objects into the run's scratch directory, never a checkout/worktree.
 * Dependency links execute the pinned historical CLI against the historical spec and templates. */
export async function historicalExport(app: Application, design = join(oldFixture, "design.json")) {
  const archive = join(dirname(app.directory), `${basename(app.directory)}-legacy.tar`);
  const source = join(dirname(app.directory), `${basename(app.directory)}-legacy-generator`);
  await mkdir(source);
  await command("git", [
    "archive",
    "--format=tar",
    "--output",
    archive,
    legacyRevision,
    "jeeves-generator",
    "jeeves/packages/spec",
    "package.json",
    "pnpm-lock.yaml",
    "pnpm-workspace.yaml",
  ]);
  await command("tar", ["-xf", archive, "-C", source]);
  await symlink(join(repository, "node_modules"), join(source, "node_modules"));
  await symlink(
    join(repository, "jeeves/packages/spec/node_modules"),
    join(source, "jeeves/packages/spec/node_modules"),
  );
  const dependencies = join(source, "jeeves-generator/node_modules");
  await mkdir(join(dependencies, "@jeeves"), { recursive: true });
  await symlink(join(source, "jeeves/packages/spec"), join(dependencies, "@jeeves/spec"));
  for (const name of await readdir(join(repository, "jeeves-generator/node_modules")))
    if (!name.startsWith("@"))
      await symlink(
        join(repository, "jeeves-generator/node_modules", name),
        join(dependencies, name),
      );
  const resolvedSpec = (
    await command(process.execPath, [
      "--input-type=module",
      "--eval",
      `import {createRequire} from 'node:module';console.log(createRequire(${JSON.stringify(join(source, "jeeves-generator/package.json"))}).resolve('@jeeves/spec'));`,
    ])
  ).trim();
  assert.equal(resolvedSpec, join(source, "jeeves/packages/spec/src/index.ts"));
  const exported = await command("pnpm", [
    "--dir",
    repository,
    "--filter",
    "@jeeves/generator",
    "exec",
    "tsx",
    join(source, "jeeves-generator/src/v2/cli.ts"),
    design,
    app.directory,
  ]);
  await writeFile(join(app.stack.artifacts, "legacy-export.log"), exported);
  const manifest = await json<{ extensionApi?: unknown }>(
    join(app.directory, ".jeeves/manifest.json"),
  );
  assert.equal(manifest.extensionApi, undefined, "Genuine GS08 metadata must remain pre-versioned");
  assert.equal(
    hash(await readFile(resolvedSpec)),
    hash(await command("git", ["show", `${legacyRevision}:jeeves/packages/spec/src/index.ts`])),
  );
  await app.save("legacy-origin.json", {
    revision: (await command("git", ["rev-parse", legacyRevision])).trim(),
    archiveSha256: hash(await readFile(archive)),
    designSha256: hash(await readFile(design)),
    designSource: design.replace(repository, "<repository>"),
    manifestSha256: hash(await readFile(join(app.directory, ".jeeves/manifest.json"))),
    extensionMetadataAbsent: true,
    noManifestRewriting: true,
    archivedWorkspaceImport: resolvedSpec.replace(source, "<archived-source>"),
    archivedSpecSha256: hash(await readFile(resolvedSpec)),
    pinnedSpecSha256: hash(
      await command("git", ["show", `${legacyRevision}:jeeves/packages/spec/src/index.ts`]),
    ),
  });
}

export async function attachFrom(app: Application, fixture: string) {
  const rows = await json<Application["attachments"]>(join(fixture, "attachments.json"));
  for (const row of rows) {
    const path = join(app.directory, row.destination);
    await mkdir(dirname(path), { recursive: true });
    await cp(join(fixture, row.source), path);
  }
  app.attachments = rows;
}

export async function publicUpdate(
  app: Application,
  source: string,
  name: string,
  options: { check?: boolean; acknowledge?: boolean; refused?: RegExp } = {},
) {
  let output: string;
  try {
    output = await app.execute(
      name,
      "pnpm",
      [
        "--dir",
        repository,
        "--filter",
        "@jeeves/generator",
        "update:v2",
        source,
        app.directory,
        ...(options.check ? ["--check"] : []),
        ...(options.acknowledge ? ["--ack-extension-api=8"] : []),
      ],
      180000,
    );
    assert(!options.refused, "Expected public CLI refusal");
  } catch (error) {
    if (!options.refused) throw error;
    output = String(error);
  }
  const envelope = output.match(/\{\n[\s\S]*?\n\}/)?.[0];
  assert(envelope, "Public update JSON result missing");
  const result = JSON.parse(envelope) as UpdateResult;
  assert.equal(result.check, options.check ?? false);
  if (options.refused) assert.match(result.refused.join("\n"), options.refused);
  else assert.deepEqual(result.refused, []);
  await app.save(`${name}.json`, result);
  return result;
}

/** Adoption and supported updates are checked against an independently fresh public export. */
export async function adoptFresh(app: Application, source: string, name: string) {
  const fresh = join(dirname(app.directory), `${basename(app.directory)}-${name}-fresh`);
  await app.execute(`${name}-fresh-export`, "pnpm", [
    "--dir",
    repository,
    "--filter",
    "@jeeves/generator",
    "export:v2",
    source,
    fresh,
  ]);
  const manifestText = await readFile(join(fresh, ".jeeves/manifest.json"));
  assert.equal(
    hash(await readFile(join(app.directory, ".jeeves/manifest.json"))),
    hash(manifestText),
  );
  app.manifest = JSON.parse(manifestText.toString());
  app.manifestHash = hash(manifestText);
  app.report = await json(join(fresh, ".jeeves/report.json"));
  for (const row of app.manifest.files)
    if (row.ownership === "generated-scaffold")
      assert.equal(hash(await readFile(join(app.directory, row.path))), row.sha256, row.path);
  await app.scaffoldCheck(name);
  return fresh;
}

export async function repeatUpdate(app: Application, source: string) {
  const before = await diskHashes(app);
  for (const name of ["identical-regeneration-1", "identical-regeneration-2"]) {
    const result = await publicUpdate(app, source, name);
    assert.equal(result.counts.create, 0);
    assert.equal(result.counts.replace, 0);
    assert.deepEqual(await diskHashes(app), before, "Identical public regeneration changed bytes");
  }
  await app.save("determinism.json", {
    consecutivePublicApplications: 2,
    exactDiskHashesUnchanged: true,
    files: before,
    digest: hash(JSON.stringify(before)),
  });
}

export async function retainedRuntime(app: Application) {
  const files = await diskHashes(app);
  const own = Object.fromEntries(
    app.attachments.map((row) => [row.destination, files[row.destination]]),
  );
  const resources = await inventory(app.stack.project);
  const volumes = JSON.parse(
    await command("docker", ["volume", "inspect", ...resources.volumes]),
  ) as {
    Name: string;
    CreatedAt: string;
    Driver: string;
    Labels: Record<string, string>;
  }[];
  return {
    project: app.stack.project,
    ports: app.stack.ports,
    own,
    runtime: Object.fromEntries(Object.entries(files).filter(([p]) => p.startsWith(".runtime/"))),
    volumes: volumes
      .map((row) => ({
        name: row.Name,
        createdAt: row.CreatedAt,
        driver: row.Driver,
        labels: row.Labels,
      }))
      .sort((a, b) => a.name.localeCompare(b.name)),
  };
}

export async function stopForUpdate(app: Application) {
  await app.execute("update-stop", "pnpm", ["stop"], 180000);
  assert.equal((await app.compose(["ps", "--status", "running", "-q"])).trim(), "");
}

/** PostgreSQL alone permits before/after observation before any updated application resumes. */
export async function inspectStoppedData<T>(app: Application, observe: () => Promise<T>) {
  await app.compose(["up", "-d", "--wait", "--no-deps", "local-postgres"], 60000);
  try {
    return await observe();
  } finally {
    await app.compose(["stop", "local-postgres"], 60000);
  }
}

type Snapshot = Record<string, string>;
async function snapshot(directory: string): Promise<Snapshot> {
  const files: Snapshot = {};
  async function walk(relative: string) {
    for (const entry of (await readdir(join(directory, relative), { withFileTypes: true })).sort(
      (a, b) => a.name.localeCompare(b.name),
    )) {
      if (["node_modules", ".runtime", "dist", ".git"].includes(entry.name)) continue;
      // Update shadows are metadata copies, never application backend production source.
      if (relative === ".jeeves" && entry.name === "generated") continue;
      const path = relative ? `${relative}/${entry.name}` : entry.name;
      assert(!entry.isSymbolicLink(), `Snapshot refuses symlink: ${path}`);
      if (entry.isDirectory()) await walk(path);
      else files[path] = await readFile(join(directory, path), "utf8");
    }
  }
  await walk("");
  return files;
}

const benchmarkScope = { version: 1, backendPaths: ["src"], uiPaths: ["browser", "public"] };
export async function countSnapshots(baseline: Snapshot, completed: Snapshot) {
  const temporary = await mkdtemp(join(tmpdir(), "jeeves-rg24-count-"));
  try {
    const gitdir = join(temporary, "objects.git");
    await command("git", ["init", "--bare", gitdir]);
    const git = (args: string[], input?: string) =>
      command("git", ["--git-dir", gitdir, ...args], {
        input,
        env: {
          GIT_AUTHOR_NAME: "RG24 snapshot",
          GIT_AUTHOR_EMAIL: "rg24@example.invalid",
          GIT_COMMITTER_NAME: "RG24 snapshot",
          GIT_COMMITTER_EMAIL: "rg24@example.invalid",
          GIT_AUTHOR_DATE: "2000-01-01T00:00:00Z",
          GIT_COMMITTER_DATE: "2000-01-01T00:00:00Z",
        },
      });
    async function commit(files: Snapshot, label: string) {
      const entries = new Map<string, string[]>();
      for (const [path, text] of Object.entries(files).sort(([a], [b]) => a.localeCompare(b))) {
        const blob = (await git(["hash-object", "-w", "--stdin"], text)).trim();
        const parts = ["app", ...path.split("/")];
        const name = parts.pop();
        assert(name);
        const parent = parts.join("/");
        const rows = entries.get(parent) ?? [];
        rows.push(`100644 blob ${blob}\t${name}`);
        entries.set(parent, rows);
        for (let i = 0; i < parts.length; i++)
          if (!entries.has(parts.slice(0, i).join("/")))
            entries.set(parts.slice(0, i).join("/"), []);
      }
      let tree = "";
      for (const path of [...entries.keys()].sort(
        (a, b) => b.split("/").length - a.split("/").length || b.length - a.length,
      )) {
        tree = (await git(["mktree"], `${entries.get(path)?.join("\n")}\n`)).trim();
        if (path) {
          const parts = path.split("/");
          const name = parts.pop();
          entries.get(parts.join("/"))?.push(`040000 tree ${tree}\t${name}`);
        }
      }
      return (await git(["commit-tree", tree], `${label}\n`)).trim();
    }
    const base = await commit(baseline, "Untouched generated snapshot");
    const final = await commit(completed, "Completed handwritten snapshot");
    assert.equal((await git(["for-each-ref"])).trim(), "", "Benchmark must create zero refs");
    return {
      report: sourceLocReport(gitdir, "app", base, final, benchmarkScope),
      provenance: {
        temporaryBareObjects: true,
        refs: 0,
        branches: 0,
        worktrees: 0,
        baselineContentSha256: hash(JSON.stringify(baseline)),
        completedContentSha256: hash(JSON.stringify(completed)),
      },
    };
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
}

export async function maintenanceReport(app: Application, fresh: string, label: string) {
  const baseline = await snapshot(fresh),
    completed = await snapshot(app.directory);
  const result = await countSnapshots(baseline, completed);
  await app.save(`${label}-source-loc.json`, result);
  await app.save(`${label}-backend-scope.json`, benchmarkScope);
  await writeFile(
    join(app.stack.artifacts, `${label}-source-loc-inputs.json.gz`),
    gzipSync(JSON.stringify({ baseline, completed })),
  );
  const sql = app.attachments
    .filter((row) => row.destination.endsWith(".sql"))
    .map((row) => {
      const text = completed[row.destination];
      assert(text);
      return {
        path: row.destination,
        sha256: hash(text),
        nonblankNonLineCommentLines: text
          .split(/\r?\n/)
          .filter((line) => line.trim() && !line.trim().startsWith("--")).length,
      };
    });
  await writeJson(join(app.stack.artifacts, `${label}-manual-sql.json`), {
    method: "Physical nonblank lines excluding -- comment-only lines; separate from source-loc-v2",
    files: sql,
    total: sql.reduce((sum, row) => sum + row.nonblankNonLineCommentLines, 0),
    handwrittenTypeScript: app.attachments
      .filter((row) => row.destination.endsWith(".ts"))
      .map((row) => {
        const text = completed[row.destination];
        assert(text);
        return {
          path: row.destination,
          sha256: hash(text),
          physicalCodeLines: codeLines(row.destination, text).length,
        };
      }),
    declarationFiles: app.attachments
      .filter((row) => row.role === "product" && row.destination.endsWith(".json"))
      .map((row) => row.destination),
    infrastructureExcluded: [
      "../rg-infra TLS/CA/issuer",
      "../rg-catalog-infra protocol/fault proxy",
      "integration harness/native probes",
      "compose.override.yaml",
      ".jeeves/generated update shadows (not runtime-imported)",
    ],
  });
  return result;
}

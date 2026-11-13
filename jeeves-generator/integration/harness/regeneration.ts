import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import type { UpdateResult } from "../../src/update.ts";
import { healthyCopies } from "./activity.ts";
import type { Application } from "./application.ts";
import { inventory } from "./cleanup.ts";
import { command, hash, poll, repository } from "./process.ts";
import { type CacheObservation, cacheHitCount, cacheObservation, catalogLoads } from "./wiring.ts";

export const regenerationTemplates = ["module-stub", "positive-cache-read"];
export const fixtureRoot = join(
  repository,
  "field-projects/generator-system/fixtures/regeneration",
);
export const published = {
  id: "published-a",
  title: "Immutable amber catalog",
  state: "published",
};
const read = (app: Application, id: string) =>
  app.request(`/api/catalog-api/modules/catalog-read/${id}`);

/** Independent scenario contract: no generated binding, TTL calculation or runtime import. */
export async function expiryBehavior(app: Application, variant: "a" | "b", label: string) {
  const bounds =
    variant === "a"
      ? { initialMinimum: 2000, maximum: 4000, expireBy: 7000, earliestExpiry: 2500 }
      : { initialMinimum: 13000, maximum: 16000, expireBy: 19000, earliestExpiry: 13000 };
  const key = "catalog:published-a";
  // Wait out any previous entry (including Valkey persistence after the stopped update).
  await poll(
    `${label}: initially absent cache entry`,
    () => cacheObservation(app, key),
    (value) => value.value === null && value.pttl === -2,
    19000,
    (value) => app.record(value),
  );
  const loads = await catalogLoads(app, published.id);
  const started = Date.now();
  assert.deepEqual(await read(app, published.id), { status: 200, body: published });
  const filled = await cacheObservation(app, key);
  assert.deepEqual(JSON.parse(filled.value ?? "null"), published);
  assert(
    filled.pttl >= bounds.initialMinimum && filled.pttl <= bounds.maximum,
    `${label}: initial PTTL ${filled.pttl} outside ${JSON.stringify(bounds)}`,
  );
  const beforeHit = await cacheHitCount(app);
  assert.deepEqual(await read(app, published.id), { status: 200, body: published });
  assert.equal((await cacheHitCount(app)) - beforeHit, 1, "INFO-only API hit measurement");
  assert.equal(await catalogLoads(app, published.id), loads + 1);
  let separation: (CacheObservation & { elapsedMs: number }) | undefined;
  if (variant === "b") {
    separation = await poll(
      `${label}: B remains cached beyond A's seven-second bound`,
      async () => ({
        elapsedMs: Date.now() - started,
        ...(await cacheObservation(app, key)),
      }),
      (value) => value.value === null || value.elapsedMs >= 7000,
      10000,
      (value) => app.record(value),
    );
    assert.deepEqual(JSON.parse(separation.value ?? "null"), published);
    assert(
      separation.pttl > 4000,
      `B must still be live beyond A's expiry: ${JSON.stringify(separation)}`,
    );
  }
  const expired = await poll(
    `${label}: actual provider expiry`,
    async () => ({
      elapsedMs: Date.now() - started,
      ...(await cacheObservation(app, key)),
    }),
    (value) => value.value === null && value.pttl === -2,
    Math.max(1, bounds.expireBy - (Date.now() - started)),
    (value) => app.record(value),
  );
  assert(
    expired.elapsedMs >= bounds.earliestExpiry && expired.elapsedMs <= bounds.expireBy,
    `${label}: expiry outside independent bounds: ${JSON.stringify(expired)}`,
  );
  assert.deepEqual(await read(app, published.id), { status: 200, body: published });
  const refilled = await cacheObservation(app, key);
  assert.deepEqual(JSON.parse(refilled.value ?? "null"), published);
  assert(refilled.pttl >= bounds.initialMinimum && refilled.pttl <= bounds.maximum);
  assert.equal(await catalogLoads(app, published.id), loads + 2);
  for (const id of ["missing-a", "draft-a"]) {
    const before = await catalogLoads(app, id);
    for (let attempt = 0; attempt < 2; attempt++) {
      assert.equal((await read(app, id)).status, 404);
      const absent = await cacheObservation(app, `catalog:${id}`);
      assert.equal(absent.value, null);
      assert.equal(absent.pttl, -2);
    }
    assert.equal(await catalogLoads(app, id), before + 2);
  }
  await app.save(`${label}-expiry.json`, {
    variant,
    bounds,
    filled,
    separation,
    expired,
    refilled,
  });
}

/** Hash the entire export except installed dependencies; never retain private file contents. */
export async function diskHashes(app: Application) {
  const files: Record<string, string> = {};
  const walk = async (relative: string) => {
    for (const entry of (
      await readdir(join(app.directory, relative), { withFileTypes: true })
    ).sort((a, b) => a.name.localeCompare(b.name))) {
      if (entry.name === "node_modules") continue;
      const path = relative ? `${relative}/${entry.name}` : entry.name;
      assert(!entry.isSymbolicLink(), `Unexpected export symlink ${path}`);
      if (entry.isDirectory()) await walk(path);
      else if (entry.isFile()) files[path] = hash(await readFile(join(app.directory, path)));
      else throw new Error(`Unexpected export entry ${path}`);
    }
  };
  await walk("");
  return files;
}

export async function preservation(app: Application) {
  const files = await diskHashes(app);
  const names = (await inventory(app.stack.project)).volumes.sort();
  assert.equal(names.length, 2, "Postgres and Valkey volumes must exist");
  const volumes = JSON.parse(await command("docker", ["volume", "inspect", ...names])) as {
    Name: string;
    CreatedAt: string;
    Driver: string;
    Labels: Record<string, string>;
  }[];
  for (const row of volumes)
    assert.equal(row.Labels["com.docker.compose.project"], app.stack.project);
  return {
    project: app.stack.project,
    ports: app.stack.ports,
    owned: Object.fromEntries(
      app.attachments.map((row) => [row.destination, files[row.destination]]),
    ),
    runtime: Object.fromEntries(
      Object.entries(files).filter(([path]) => path.startsWith(".runtime/")),
    ),
    volumes: volumes.map((row) => ({
      name: row.Name,
      createdAt: row.CreatedAt,
      driver: row.Driver,
      labels: row.Labels,
    })),
  };
}

export async function retainedData(app: Application) {
  return JSON.parse(
    await app.sql(
      `SELECT json_build_object(
    'databaseOid', (SELECT oid FROM pg_database WHERE datname=current_database()),
    'relationOid', 'm_catalog_writer.records'::regclass::oid,
    'count', count(*), 'records', json_agg(json_build_object(
      'id', id, 'title', title, 'state', state, 'xmin', xmin::text) ORDER BY id))
    FROM m_catalog_writer.records`,
      "d_catalog",
    ),
  ) as {
    databaseOid: string;
    relationOid: string;
    count: number;
    records: { id: string; title: string; state: string; xmin: string }[];
  };
}

export async function update(app: Application, label: string, check: boolean) {
  const output = await app.execute(label, "pnpm", [
    "--dir",
    repository,
    "--filter",
    "@jeeves/generator",
    "update:v2",
    join(fixtureRoot, "design-b.json"),
    app.directory,
    ...(check ? ["--check"] : []),
  ]);
  const value = JSON.parse(output.slice(output.indexOf("{\n"))) as UpdateResult;
  await app.save(`${label}.json`, value);
  assert.equal(value.check, check);
  assert.deepEqual(value.refused, []);
  for (const key of ["keepChanged", "override", "remove", "orphan"] as const)
    assert.deepEqual(value[key], []);
  assert.equal(value.counts.create, 0);
  assert.equal(value.counts.keep, app.attachments.length);
  return value;
}

/** Adopt B only after checking against the independently exported, unmodified B manifest. */
export async function verifyTransition(
  app: Application,
  oracle: Pick<Application, "manifest" | "manifestHash" | "report">,
) {
  const before = app.manifest;
  const manifestHash = hash(await readFile(join(app.directory, ".jeeves/manifest.json")));
  assert.equal(
    manifestHash,
    oracle.manifestHash,
    "Updated manifest differs from separate fresh B export",
  );
  const owned = new Set(app.attachments.map((row) => row.destination));
  for (const file of oracle.manifest.files) {
    if (owned.has(file.path)) {
      assert.equal(file.ownership, "generated-extension");
      continue;
    }
    assert.equal(
      hash(await readFile(join(app.directory, file.path))),
      file.sha256,
      `Updated file differs from separate fresh B: ${file.path}`,
    );
  }
  await app.save("baseline-transition.json", {
    originalManifestHash: app.manifestHash,
    freshBManifestHash: oracle.manifestHash,
    updatedManifestHash: manifestHash,
    intentionalChanges: oracle.manifest.files
      .filter((file) => before.files.find((row) => row.path === file.path)?.sha256 !== file.sha256)
      .map((file) => ({
        path: file.path,
        ownership: file.ownership,
        before: before.files.find((row) => row.path === file.path)?.sha256,
        after: file.sha256,
      })),
    verifiedAgainstSeparateFreshB: true,
  });
  app.manifest = oracle.manifest;
  app.manifestHash = oracle.manifestHash;
  app.report = oracle.report;
  await app.scaffoldCheck("updated-b");
}

export async function resumed(app: Application) {
  await app.execute("updated-start", "pnpm", ["start"], 600000);
  for (const service of ["local-postgres", "cache-catalog-cache", "app-catalog-api", "app-edge"])
    await healthyCopies(app, service, 1);
}

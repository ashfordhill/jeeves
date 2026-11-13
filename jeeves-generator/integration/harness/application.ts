import assert from "node:assert/strict";
import { lstat, mkdir, readFile, writeFile } from "node:fs/promises";
import { createServer } from "node:net";
import { dirname, join } from "node:path";
import { gzipSync } from "node:zlib";
import { assertSafeOutputPath } from "../../src/files.ts";
import type { assembleV2 } from "../../src/v2/assemble.ts";
import type { RunRecord, StackRecord } from "./cleanup.ts";
import { cleanupStackResources, inventory } from "./cleanup.ts";
import { sanitizeJson, sanitizer } from "./evidence.ts";
import { command, hash, json, poll, repository, sourceSnapshot, writeJson } from "./process.ts";

type Report = ReturnType<typeof assembleV2>["report"];
type Manifest = { files: { path: string; sha256: string; ownership: string }[] };
type Attachment = {
  source: string;
  destination: string;
  role: "stub" | "hooks" | "sql";
  module: string;
};
async function freePorts() {
  const servers = Array.from({ length: 3 }, () => createServer());
  try {
    const ports: number[] = [];
    for (const server of servers) {
      await new Promise<void>((done, reject) => {
        server.once("error", reject);
        server.listen(0, "127.0.0.1", done);
      });
      const address = server.address();
      if (!address || typeof address === "string") throw new Error("No loopback port");
      ports.push(address.port);
    }
    return ports;
  } finally {
    await Promise.all(
      servers.map((server) => new Promise<void>((done) => server.close(() => done()))),
    );
  }
}

export class Application {
  readonly observations: unknown[] = [];
  phase: "setup" | "assertion" = "setup";
  manifest!: Manifest;
  manifestHash = "";
  report!: Report;
  attachments: Attachment[] = [];
  readonly env: NodeJS.ProcessEnv;
  constructor(
    readonly stack: StackRecord,
    readonly runPath: string,
  ) {
    this.env = {
      COMPOSE_PROJECT_NAME: stack.project,
      LOCAL_HTTP_PORT: String(stack.ports[0]),
      LOCAL_IDENTITY_PORT: String(stack.ports[1]),
      LOCAL_OBJECT_PORT: String(stack.ports[2]),
    };
  }
  get directory() {
    return this.stack.application;
  }
  record(value: unknown) {
    this.observations.push(value);
  }
  async save(name: string, value: unknown) {
    await writeJson(join(this.stack.artifacts, name), value);
  }
  async execute(name: string, program: string, args: string[], timeoutMs = 60_000) {
    try {
      const value = await command(program, args, { cwd: this.directory, env: this.env, timeoutMs });
      await writeFile(
        join(this.stack.artifacts, `${name}.log`),
        (await sanitizer(this.directory))(value),
      );
      return value;
    } catch (error) {
      const clean = (await sanitizer(this.directory))(String(error));
      await writeFile(join(this.stack.artifacts, `${name}.log`), clean);
      throw new Error(clean);
    }
  }
  compose(args: string[], timeoutMs = 60_000) {
    return command("docker", ["compose", "--profile", "*", ...args], {
      cwd: this.directory,
      env: this.env,
      timeoutMs,
    });
  }
  async containers(service: string) {
    return (await this.compose(["ps", "-aq", service])).trim().split(/\s+/).filter(Boolean);
  }
  async sql(sql: string, database = "d_totals") {
    const [id] = await this.containers("local-postgres");
    assert(id, "Postgres container missing");
    // Administrative observation only. Application reads go through the edge with its reader login.
    const result = await command(
      "docker",
      [
        "exec",
        "-i",
        id,
        "psql",
        "-U",
        "postgres",
        "-d",
        database,
        "-X",
        "-v",
        "ON_ERROR_STOP=1",
        "-At",
      ],
      { input: sql, timeoutMs: 10_000 },
    );
    this.record({ sql, result: result.trim() });
    return result.trim();
  }
  async request(path: string, init: RequestInit = {}) {
    const started = performance.now();
    const response = await fetch(`http://127.0.0.1:${this.stack.ports[0]}${path}`, {
      ...init,
      signal: AbortSignal.timeout(5_000),
    });
    const text = await response.text();
    let body: unknown = text;
    try {
      body = JSON.parse(text);
    } catch {
      /* Non-JSON failure body is useful evidence. */
    }
    this.record({
      method: init.method ?? "GET",
      path,
      request: init.body,
      status: response.status,
      body,
      elapsedMs: Math.round(performance.now() - started),
    });
    return { status: response.status, body };
  }
  async scaffoldCheck(label: string) {
    assert.equal(
      hash(await readFile(join(this.directory, ".jeeves/manifest.json"))),
      this.manifestHash,
      "Manifest changed",
    );
    const changed = [];
    for (const file of this.manifest.files) {
      const actual = hash(await readFile(join(this.directory, file.path)));
      if (actual !== file.sha256)
        changed.push({ path: file.path, ownership: file.ownership, sha256: actual });
    }
    const owned = new Set(this.attachments.map((item) => item.destination));
    assert(
      changed.every((file) => file.ownership === "generated-extension" && owned.has(file.path)),
      `Scaffold changed: ${JSON.stringify(changed)}`,
    );
    await this.save(`${label}-hashes.json`, { changedOwned: changed, scaffoldUnchanged: true });
  }
  async capture() {
    const clean = await sanitizer(this.directory);
    await this.save("observations.json", sanitizeJson(this.observations, clean));
    try {
      await this.save("containers.json", await inventory(this.stack.project));
      await writeFile(
        join(this.stack.artifacts, "compose-state.log"),
        clean(await this.compose(["ps", "-a"])),
      );
      await writeFile(
        join(this.stack.artifacts, "containers.log"),
        clean(await this.compose(["logs", "--no-color", "--timestamps", "--tail", "200"])),
      );
    } catch (error) {
      await this.save("capture-error.json", { error: clean(String(error)) });
    }
    if (this.manifest) await this.scaffoldCheck("final");
  }
}

export async function createApplication(fixture: string) {
  if (!/^[a-z][a-z0-9-]*$/.test(fixture)) throw new Error("Invalid fixture");
  const runPath = process.env.JEEVES_SYSTEM_RECORD;
  if (!runPath) throw new Error("Use pnpm test:generated to establish isolated run ownership");
  const run = await json<RunRecord>(runPath);
  const number = run.stacks.length + 1;
  const stack: StackRecord = {
    project: `${run.id}-${number}`,
    fixture,
    application: join(run.temporary, `${number}-${fixture}`),
    artifacts: join(dirname(runPath), `${number}-${fixture}`),
    ports: await freePorts(),
  };
  run.stacks.push(stack);
  await writeJson(runPath, run);
  await mkdir(stack.artifacts, { recursive: true });
  const app = new Application(stack, runPath);
  return app;
}

export async function setupApplication(
  app: Application,
  templates: string[],
  designFile = "design.json",
) {
  const fixture = join(repository, "field-projects/generator-system/fixtures", app.stack.fixture);
  assertSafeOutputPath(designFile);
  const before = await sourceSnapshot();
  await app.save("source-before.json", before);
  const runSource = await json<{ sha256: string }>(join(dirname(app.runPath), "source.json"));
  assert.equal(before.sha256, runSource.sha256, "Source changed since run began");
  const exported = await command(
    "pnpm",
    ["--filter", "@jeeves/generator", "export:v2", join(fixture, designFile), app.directory],
    { timeoutMs: 60_000 },
  );
  await writeFile(join(app.stack.artifacts, "export.log"), exported);
  for (const name of ["manifest", "report"])
    await writeFile(
      join(app.stack.artifacts, `${name}.json.gz`),
      gzipSync(await readFile(join(app.directory, `.jeeves/${name}.json`))),
    );
  app.manifestHash = hash(await readFile(join(app.directory, ".jeeves/manifest.json")));
  app.manifest = await json<Manifest>(join(app.directory, ".jeeves/manifest.json"));
  app.report = await json<Report>(join(app.directory, ".jeeves/report.json"));
  assert.deepEqual(app.report.findings, []);
  assert.equal(app.report.processes?.runnable, true);
  assert.deepEqual(
    app.report.selections.map((row) => row.template.id).sort(),
    [...templates].sort(),
  );
  assert(app.report.selections.every((row) => row.status === "implemented"));
  app.attachments = await json<Attachment[]>(join(fixture, "attachments.json"));
  assert.equal(new Set(app.attachments.map((row) => row.destination)).size, app.attachments.length);
  for (const attachment of app.attachments) {
    assertSafeOutputPath(attachment.source);
    assertSafeOutputPath(attachment.destination);
    assert(attachment.source.startsWith("owned/"));
    const file = app.manifest.files.find((row) => row.path === attachment.destination);
    assert.equal(
      file?.ownership,
      "generated-extension",
      `Attachment is not owned extension: ${attachment.destination}`,
    );
    const module = app.report.modules?.find((row) => row.module === attachment.module);
    const valid =
      attachment.role === "hooks"
        ? app.report.processes?.tiles.some((tile) =>
            tile.hooks.some(
              (hook) =>
                hook.selection === module?.selection && hook.file === attachment.destination,
            ),
          )
        : attachment.role === "sql"
          ? module?.sql?.some((row) => row.file === attachment.destination)
          : module?.status === "stub" &&
            module.files.includes(attachment.destination) &&
            !attachment.destination.endsWith(".slots.ts");
    assert(valid, `Attachment not reported for ${attachment.module}: ${attachment.destination}`);
    assert(!attachment.destination.startsWith(".jeeves/"));
    assert(
      (await lstat(join(fixture, attachment.source))).isFile(),
      "Attachment source must be a file, not a symlink",
    );
    await writeFile(
      join(app.directory, attachment.destination),
      await readFile(join(fixture, attachment.source)),
    );
  }
  await app.scaffoldCheck("attached");
  await app.execute("install", "pnpm", ["install", "--frozen-lockfile"], 180_000);
  await app.execute("build", "pnpm", ["build"], 120_000);
  assert.equal(
    (await sourceSnapshot()).sha256,
    before.sha256,
    "Source changed during export/install/build",
  );
  await app.execute("first-run", "pnpm", ["first-run"], 600_000);
  await poll(
    "all generated application containers healthy",
    async () => {
      const ids = (await app.compose(["ps", "-q"])).trim().split(/\s+/).filter(Boolean);
      if (!ids.length) return [];
      const inspected = JSON.parse(await command("docker", ["inspect", ...ids])) as {
        Name: string;
        State: { Status: string; Health?: { Status: string } };
      }[];
      return inspected.map((row) => ({
        name: row.Name,
        status: row.State.Status,
        health: row.State.Health?.Status,
      }));
    },
    (rows) =>
      rows.length > 0 && rows.every((row) => row.status === "running" && row.health === "healthy"),
    60_000,
    (value) => app.record(value),
  );
  assert.equal((await sourceSnapshot()).sha256, before.sha256, "Source changed during startup");
  app.phase = "assertion";
}

/** Capture and release each stack; outer cleanup keeps private reporter redactions alive. */
export async function withApplication(
  fixture: string,
  templates: string[],
  behavior: (app: Application) => Promise<void>,
  designFile = "design.json",
) {
  const app = await createApplication(fixture);
  let failed: unknown;
  try {
    await setupApplication(app, templates, designFile);
    await behavior(app);
  } catch (error) {
    failed = error;
  }
  try {
    await app.capture();
  } catch (error) {
    failed ??= error;
  }
  await app.save("result.json", {
    fixture,
    phase: app.phase,
    outcome: failed ? "failed" : "passed",
    error: failed ? (await sanitizer(app.directory))(String(failed)) : undefined,
  });
  try {
    await app.save("stack-cleanup.json", await cleanupStackResources(app.stack));
  } catch (error) {
    failed ??= error;
    await app.save("result.json", {
      fixture,
      phase: "cleanup",
      outcome: "failed",
      error: (await sanitizer(app.directory))(String(failed)),
    });
  }
  if (failed) throw failed;
}

import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import {
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { readFile } from "node:fs/promises";
import { stripTypeScriptTypes } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { pathToFileURL } from "node:url";
import { designSchema, generationRuntime } from "@jeeves/spec";
import { describe, expect, it } from "vitest";
import { withStubWorkloads } from "../../../field-projects/generator-system/fixtures/rg-workload/design.ts";
import { stubStackDesign } from "../../../jeeves/packages/spec/src/fixtures/stub-stack.ts";
import { runStudioCommands } from "../../../jeeves/packages/spec/src/fixtures/v2-modules.ts";
import {
  generationSelectionsFixture,
  generationSourceFixture,
} from "../../../jeeves/packages/spec/src/fixtures/yv2-selections.ts";
import {
  loadLocalV2Registry as loadApplicationRegistry,
  loadLocalV2Dependencies as loadLocalV2Registry,
} from "../../templates/local-v2/index.ts";
import { assembleV2 } from "./assemble.ts";
import { offDesigns } from "./fixtures/processes-off.ts";
import type { V2Emitter } from "./registry.ts";

const source = () => {
  const generation = generationSelectionsFixture();
  return designSchema.parse({
    ...generationSourceFixture(),
    generation: {
      version: 1,
      runtime: generationRuntime.ref,
      selections: generation.selections.filter((s) => s.id === "ready-reader"),
    },
  });
};
const emit = (design = source(), features: V2Emitter[] = []) =>
  assembleV2({ designJson: JSON.stringify(design) }, loadLocalV2Registry(features));
const text = (bundle: ReturnType<typeof emit>, path: string) =>
  new TextDecoder().decode(bundle.files.find((f) => f.path === path)?.bytes);
const hook = (id: string, local: NonNullable<V2Emitter["local"]>): V2Emitter => ({
  id,
  version: "0.1.0",
  status: "diagnostic",
  description: "Offline composition probe, not installed feature support.",
  sourcePaths: ["jeeves-generator/src/v2/local.test.ts"],
  local,
  render: () => ({ files: [] }),
});

describe("standalone local foundation", () => {
  it("emits only selected providers and no domain application, secrets or blanket table grants", () => {
    const bundle = emit();
    const compose = JSON.parse(text(bundle, "compose.yaml"));
    expect(Object.keys(compose.services).sort()).toEqual([
      "cache-metadata-cache",
      "local-postgres",
      "setup-migrate",
    ]);
    expect(compose.services["local-postgres"].secrets).toEqual(["postgres-admin"]);
    expect(compose.services["setup-migrate"].profiles).toEqual(["setup"]);
    const plan = JSON.parse(text(bundle, "infra/local.json"));
    expect(plan.databases).toMatchObject([
      { resource: "metadata-db", database: "d_metadata_db", owner: "o_metadata_db" },
    ]);
    expect(plan.logins).toEqual([]);
    expect(plan.application).toEqual([]);
    expect(plan.objects).toEqual([]);
    expect(bundle.files.some((f) => f.path.startsWith(".runtime/"))).toBe(false);
    expect(bundle.files.some((f) => f.path.startsWith("src/services/"))).toBe(false);
    expect(text(bundle, "scripts/migrate.mjs")).not.toContain("GRANT SELECT ON ALL");
    expect(text(bundle, "scripts/migrate.mjs")).toContain("quote(db.database)");
    expect(text(bundle, "scripts/local.mjs")).toContain("No replacement will be created");
    expect(bundle.report.applicationComplete).toBe(false);
    const empty = source();
    if (empty.schemaVersion !== 3 || !empty.generation) throw new Error();
    empty.generation.selections = [];
    expect(JSON.parse(text(emit(empty), "compose.yaml")).services).toEqual({});
    const full = emit(
      designSchema.parse({
        ...generationSourceFixture(),
        generation: generationSelectionsFixture(),
      }),
    );
    const fullPlan = JSON.parse(text(full, "infra/local.json"));
    expect(
      fullPlan.databases.find((db: { resource: string }) => db.resource === "identity"),
    ).toMatchObject({ owner: "io_identity", secret: "identity-owner-identity" });
    expect(fullPlan.providerLogins).toMatchObject([
      { user: "ik_identity", secret: "identity-identity", provider: "identity" },
    ]);
    const fullCompose = JSON.parse(text(full, "compose.yaml"));
    expect(fullCompose.services["identity-identity"].environment.KC_DB_USERNAME).toBe(
      "ik_identity",
    );
    expect(fullCompose.services["identity-identity"].secrets).toBeUndefined();
    expect(fullCompose.services["setup-migrate"].secrets).toContain("identity-owner-identity");
  });

  it("composes typed cross-module logins/views/grants with exact contributors and setup-only owner mounts", () => {
    const features = [
      hook("probe.a-grant", () => ({
        sourcePaths: ["/generation/selections/0"],
        grants: [
          {
            resource: "metadata-db",
            host: "watch",
            schema: "published",
            relation: "ready_records",
            kind: "view",
            privileges: ["SELECT"],
          },
        ],
      })),
      hook("probe.z-view", () => ({
        sourcePaths: ["/generation/selections/0"],
        logins: [{ resource: "metadata-db", host: "watch" }],
        migrations: [
          { resource: "metadata-db", id: "001-probe.sql", sql: 'CREATE SCHEMA "published";' },
        ],
        views: [
          {
            resource: "metadata-db",
            schema: "published",
            name: "ready_records",
            selectSql: "SELECT 1 AS id",
          },
        ],
        services: [
          {
            host: "watch",
            command: ["node", "scripts/status.mjs"],
            dependsOn: ["metadata-db"],
            sql: ["metadata-db"],
          },
        ],
      })),
    ];
    const bundle = emit(source(), features);
    const compose = JSON.parse(text(bundle, "compose.yaml"));
    expect(compose.services["app-watch"].secrets).toEqual(["sql-metadata-db--watch"]);
    expect(compose.services["app-watch"].secrets).not.toContain("owner-metadata-db");
    expect(compose.services["setup-migrate"].secrets).toContain("owner-metadata-db");
    const plan = JSON.parse(text(bundle, "infra/local.json"));
    expect(plan.logins[0].user).toBe("r_metadata_db__watch");
    expect(plan.grants[0]).toMatchObject({ schema: "published", privileges: ["SELECT"] });
    expect(
      bundle.manifest.files
        .find((f) => f.path === "infra/local.json")
        ?.contributors.map((c) => c.emitter.id),
    ).toEqual(["probe.a-grant", "probe.z-view"]);
    expect(
      bundle.manifest.files.find((f) => f.path === "src/runtime/local.ts")?.contributors,
    ).toEqual([]);
    const grant = features[0];
    if (!grant) throw new Error();
    expect(() =>
      emit(source(), [
        {
          ...grant,
          local: () => ({
            sourcePaths: ["/generation/selections/0"],
            logins: [{ resource: "metadata-db", host: "watch" }],
            grants: [
              {
                resource: "metadata-db",
                host: "watch",
                relation: "private_records",
                kind: "table",
                privileges: ["SELECT"],
              },
            ],
          }),
        },
      ]),
    ).toThrow(/publication|boundary/i);
  });

  it("refuses composed provider limits without truncation and changes actual provider output with canonical bindings", () => {
    const design = source();
    const longId = `d${"a".repeat(62)}`;
    const rename = JSON.stringify(design).replaceAll('"metadata-db"', JSON.stringify(longId));
    expect(() => emit(designSchema.parse(JSON.parse(rename)))).toThrowError(
      expect.objectContaining({ code: "LOCAL_IDENTITY_LIMIT" }),
    );
    const renamed = designSchema.parse(
      JSON.parse(JSON.stringify(design).replaceAll('"metadata-db"', '"select"')),
    );
    const plan = JSON.parse(text(emit(renamed), "infra/local.json"));
    expect(plan.databases[0]).toMatchObject({
      resource: "select",
      database: "d_select",
      owner: "o_select",
    });
    expect(text(emit(renamed), "infra/postgres/select/000-foundation.sql")).toContain("REVOKE ALL");
    expect(text(emit(renamed), "infra/local.json")).not.toBe(text(emit(), "infra/local.json"));
  });

  it("leaves compose.override.yaml to the application and never bypasses Compose's merge", () => {
    const own =
      "**Your own configuration.** `compose.override.yaml` beside `compose.yaml` is yours: export never writes it and `update:v2` never touches it. Docker Compose merges it into every command `pnpm first-run`, `start` and `stop` run, so give your modules their own `environment` and `secrets` there, or add a service of your own (for example a scheduler that calls your routes). A service of your own starts with `pnpm start` only when a generated service `depends_on` it, which your override may add; otherwise start it with your own `docker compose up`. Don't redefine a generated service's image, command, ports or healthcheck. A change applies at the next `pnpm start`.";
    const processes = assembleV2(
      {
        designJson: JSON.stringify(
          runStudioCommands(withStubWorkloads(stubStackDesign()), [
            { type: "setRunnableProcesses", on: true },
          ]),
        ),
      },
      loadApplicationRegistry(),
    );
    expect(processes.manifest.processes).toBe(true);
    for (const bundle of [emit(), processes]) {
      const paths = bundle.files.map((f) => f.path);
      expect(paths).not.toContain("compose.override.yaml");
      expect(bundle.manifest.files.map((f) => f.path)).not.toContain("compose.override.yaml");
      for (const script of ["scripts/common.mjs", "scripts/local.mjs"]) {
        expect(paths).toContain(script);
        for (const bypass of ['"-f"', '"--file"', '"--project-directory"', "COMPOSE_FILE"])
          expect(text(bundle, script)).not.toContain(bypass);
      }
      // The composition hash covers only generated files, so editing the override never refuses start.
      expect(text(bundle, "scripts/local.mjs")).toContain(
        'Buffer.concat([readFileSync("compose.yaml"), readFileSync("infra/local.json")])',
      );
      const readme = text(bundle, "README.md");
      expect(readme).toContain(`\n\n${own}\n\n`);
      expect(readme.indexOf(own)).toBeGreaterThan(readme.indexOf("Run `pnpm first-run` once"));
    }
  });

  it("gives the application its package manifests with the template's bytes (QG03)", async () => {
    const processes = assembleV2(
      {
        designJson: JSON.stringify(
          runStudioCommands(withStubWorkloads(stubStackDesign()), [
            { type: "setRunnableProcesses", on: true },
          ]),
        ),
      },
      loadApplicationRegistry(),
    );
    const ownership = (bundle: ReturnType<typeof emit>, path: string) =>
      bundle.manifest.files.find((f) => f.path === path)?.ownership;
    for (const bundle of [emit(), processes]) {
      for (const path of ["package.json", "pnpm-lock.yaml"]) {
        expect(ownership(bundle, path)).toBe("generated-extension");
        expect(text(bundle, path)).toBe(
          await readFile(
            new URL(`../../templates/local-v2/assets/${path}`, import.meta.url),
            "utf8",
          ),
        );
      }
      // The rest of the project stays generated; the image installs exactly the lock.
      for (const path of ["tsconfig.json", "Dockerfile", "scripts/local.mjs", "compose.yaml"])
        expect(ownership(bundle, path)).toBe("generated-scaffold");
      expect(text(bundle, "Dockerfile")).toContain(
        "COPY package.json pnpm-lock.yaml ./\nRUN pnpm install --frozen-lockfile --ignore-scripts\n",
      );
    }
  });

  it("runs the app and media images as the base image's non-root node user", () => {
    const processes = assembleV2(
      {
        designJson: JSON.stringify(
          runStudioCommands(withStubWorkloads(stubStackDesign()), [
            { type: "setRunnableProcesses", on: true },
          ]),
        ),
      },
      loadApplicationRegistry(),
    );
    for (const bundle of [emit(), processes]) {
      const dockerfile = text(bundle, "Dockerfile");
      const stages = Object.fromEntries(
        dockerfile
          .split(/^(?=FROM )/m)
          .map((stage) => [stage.match(/ AS (\w+)\n/)?.[1], stage.trimEnd().split("\n")]),
      );
      expect(Object.keys(stages)).toEqual(["app", "ffmpeg", "media"]);
      // Every build step runs as root first; only the run-time user changes.
      expect(stages.app.slice(-3)).toEqual([
        "RUN pnpm build",
        "USER node",
        'CMD ["node", "scripts/status.mjs"]',
      ]);
      expect(dockerfile.indexOf("COPY . .")).toBeLessThan(dockerfile.indexOf("RUN pnpm build"));
      expect(text(bundle, "scripts/check-extensions.mjs")).toContain(".jeeves/manifest.json");
      expect(stages.media.slice(-3)).toEqual([
        "COPY --from=app /app /app",
        "USER node",
        'CMD ["node", "dist/services/media.js"]',
      ]);
      expect(dockerfile.match(/^USER /gm)).toHaveLength(2);
      // /app stays root-owned and readable: nothing changes its owner or mode.
      expect(dockerfile).not.toMatch(/--chown|--chmod|\bchown\b|\bchmod\b/);
      // Compose never overrides the image's user for a built service.
      const compose = JSON.parse(text(bundle, "compose.yaml"));
      for (const service of Object.values<{ build?: unknown; user?: unknown }>(compose.services))
        if (service.build) expect(service.user).toBeUndefined();
    }
    // At run time a process writes only its ready marker, under /tmp.
    const lifecycle = text(processes, "src/runtime/process.ts");
    expect(lifecycle).toContain('writeFileSync("/tmp/application-ready", "ready\\n")');
    expect(lifecycle).toContain('rmSync("/tmp/application-ready", { force: true })');
  });

  it("sets each secret's mode after writing it, so the host umask can't narrow it (QG22)", () => {
    const processes = assembleV2(
      {
        designJson: JSON.stringify(
          runStudioCommands(withStubWorkloads(stubStackDesign()), [
            { type: "setRunnableProcesses", on: true },
          ]),
        ),
      },
      loadApplicationRegistry(),
    );
    const full = emit(
      designSchema.parse({
        ...generationSourceFixture(),
        generation: generationSelectionsFixture(),
      }),
    );
    for (const bundle of [emit(), processes, full]) {
      // open(2) masks writeFileSync's mode with the umask; chmod sets the same mode exactly.
      const setup = text(bundle, "scripts/setup.mjs");
      expect(setup).toContain(
        [
          `    const path = \`.runtime/secrets/\${name}\`;`,
          '    writeFileSync(path, value, { mode, flag: "wx" });',
          "    // The host's umask masks `mode`; containers run as `node`, so set it exactly.",
          "    chmodSync(path, mode);\n",
        ].join("\n"),
      );
      const bootstrap = text(bundle, "scripts/bootstrap.mjs");
      expect(bootstrap).toContain(
        [
          `  const path = \`.runtime/secrets/\${name}\`;`,
          "  writeFileSync(path, JSON.stringify({ accessKeyId, secretAccessKey }), {",
          "    mode: 0o644,",
          '    flag: "wx",',
          "  });",
          "  // The host's umask masks `mode`; containers run as `node`, so set it exactly.",
          "  chmodSync(path, 0o644);\n",
        ].join("\n"),
      );
      for (const script of [setup, bootstrap])
        expect(script.match(/\bchmodSync\(/g)?.length).toBe(
          script.match(/\bwriteFileSync\(/g)?.length,
        );
    }
    // The emitted setup, run under umask 077: every secret a container mounts is 0644, and
    // Garage's own config keeps 0600.
    const dir = mkdtempSync(join(tmpdir(), "jeeves-qg22-"));
    try {
      for (const path of ["scripts/common.mjs", "scripts/setup.mjs", "infra/local.json"]) {
        mkdirSync(dirname(join(dir, path)), { recursive: true });
        writeFileSync(join(dir, path), text(full, path));
      }
      const script = pathToFileURL(join(dir, "scripts/setup.mjs")).href;
      const run = spawnSync(
        process.execPath,
        [
          "--input-type=module",
          "-e",
          `process.umask(0o077); (await import(${JSON.stringify(script)})).setup();`,
        ],
        { encoding: "utf8", env: { ...process.env, LOCAL_HTTP_PORT: "47900" } },
      );
      expect(run.status, run.stderr).toBe(0);
      const secrets = join(dir, ".runtime/secrets");
      const modes = Object.fromEntries(
        readdirSync(secrets).map((name) => [name, statSync(join(secrets, name)).mode & 0o777]),
      );
      const plan = JSON.parse(text(full, "infra/local.json"));
      // Every planned secret except the storage keys, which bootstrap writes later.
      expect(Object.keys(modes).sort()).toEqual(
        plan.secrets.filter((name: string) => !plan.generatedSecrets.includes(name)).sort(),
      );
      for (const [name, mode] of Object.entries(modes))
        expect([name, mode]).toEqual([name, name === "garage.toml" ? 0o600 : 0o644]);
      expect(statSync(secrets).mode & 0o777).toBe(0o700);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("ends every emitted file with one newline, never a blank line (QG32)", () => {
    const processes = assembleV2(
      {
        designJson: JSON.stringify(
          runStudioCommands(withStubWorkloads(stubStackDesign()), [
            { type: "setRunnableProcesses", on: true },
          ]),
        ),
      },
      loadApplicationRegistry(),
    );
    const full = emit(
      designSchema.parse({
        ...generationSourceFixture(),
        generation: generationSelectionsFixture(),
      }),
    );
    // QRWTY's Q03 probe, as the regeneration proof exports it.
    const probe = assembleV2(
      {
        designJson: readFileSync(
          new URL("../../../docs/plans/qrwty-gaps/fixtures/probe-design.json", import.meta.url),
          "utf8",
        ),
      },
      loadApplicationRegistry(),
    );
    const blankAtEnd = new Set<string>();
    const endings: [string, boolean][] = [];
    for (const bundle of [emit(), processes, full, probe]) {
      for (const { path, bytes } of bundle.files) {
        const end = Array.from(bytes.subarray(-2));
        if (end.length === 2 && end[0] === 0x0a && end[1] === 0x0a) blankAtEnd.add(path);
      }
      for (const path of ["Dockerfile", "src/features/service-resources.ts"]) {
        if (!bundle.files.some((f) => f.path === path)) continue;
        const content = text(bundle, path);
        endings.push([path, content.endsWith("\n") && !content.endsWith("\n\n")]);
      }
    }
    expect([...blankAtEnd].sort()).toEqual([]);
    // Each where the export has it, with exactly one final newline.
    expect(new Set(endings.map(([path]) => path))).toEqual(
      new Set(["Dockerfile", "src/features/service-resources.ts"]),
    );
    for (const ending of endings) expect(ending).toEqual([ending[0], true]);
  });

  it("migrates one copy at a time and completes with a non-superuser admin", () => {
    const processes = assembleV2(
      {
        designJson: JSON.stringify(
          runStudioCommands(withStubWorkloads(stubStackDesign()), [
            { type: "setRunnableProcesses", on: true },
          ]),
        ),
      },
      loadApplicationRegistry(),
    );
    for (const bundle of [emit(), processes]) {
      const script = text(bundle, "scripts/migrate.mjs");
      // Every statement on the admin connection whose text is a literal, in source order.
      const admin = [...script.matchAll(/admin\.query\(\s*(["`])(.*?)\1/gs)].map((m) => m[2]);
      expect(admin).toEqual([
        "SELECT pg_advisory_lock(hashtext($1))",
        "SELECT rolsuper FROM pg_roles WHERE rolname = current_user",
        "SELECT 1 FROM pg_roles WHERE rolname=$1",
        "SELECT format('CREATE ROLE %I LOGIN PASSWORD %L', $1::text, $2::text) AS sql",
        `GRANT \${quote(login.user)} TO CURRENT_USER WITH INHERIT FALSE, SET TRUE`,
        ...(bundle === processes
          ? [
              "SELECT 1 FROM pg_roles WHERE rolname=$1",
              `CREATE ROLE \${quote(namespace.role)} NOLOGIN NOINHERIT`,
              `GRANT \${quote(namespace.role)} TO \${quote(db.owner)} WITH INHERIT FALSE, SET TRUE`,
            ]
          : []),
        "SELECT pg_get_userbyid(datdba) AS owner FROM pg_database WHERE datname=$1",
        `CREATE DATABASE \${quote(db.database)} OWNER \${quote(db.owner)}`,
        `SET ROLE \${quote(db.owner)}`,
        `REVOKE ALL ON DATABASE \${quote(db.database)} FROM PUBLIC`,
        `GRANT CONNECT ON DATABASE \${quote(db.database)} TO \${quote(login.user)}`,
        "RESET ROLE",
        "SELECT pg_advisory_unlock(hashtext($1))",
      ]);
      // The cluster lock comes first and is released only after the last database is done.
      const lock =
        '  await admin.query("SELECT pg_advisory_lock(hashtext($1))", ["local-v2:cluster"]);\n';
      expect(script).toContain(`\n${lock}`);
      expect(script.indexOf("\ntry {\n")).toBeLessThan(script.indexOf(lock));
      expect(script.indexOf(lock)).toBeLessThan(script.indexOf("CREATE ROLE"));
      expect(script).toContain(
        '    }\n  }\n  await admin.query("SELECT pg_advisory_unlock(hashtext($1))", ["local-v2:cluster"]);\n} finally {\n  await admin.end();\n}\n',
      );
      // The owner grant is only for a non-superuser admin, and only for database owners.
      expect(script.match(/SELECT rolsuper/g)).toHaveLength(1);
      expect(script.indexOf("SELECT rolsuper")).toBeLessThan(script.indexOf("for (const login of"));
      expect(script).toContain(
        `    if (!superuser && owners.has(login.user))\n      await admin.query(\`GRANT \${quote(login.user)} TO CURRENT_USER WITH INHERIT FALSE, SET TRUE\`);\n`,
      );
      expect(script).toContain("const owners = new Set(plan.databases.map((db) => db.owner));");
      // Every database-level statement runs as the owner, with nothing else in between.
      const asOwner = script.slice(
        script.indexOf(`SET ROLE \${quote(db.owner)}`),
        script.indexOf('"RESET ROLE"'),
      );
      expect(script.match(/ON DATABASE/g)).toHaveLength(2);
      expect(asOwner.match(/ON DATABASE/g)).toHaveLength(2);
      expect(asOwner).not.toMatch(/owner\.query|connect\(/);
      expect(script.indexOf("CREATE DATABASE")).toBeLessThan(
        script.indexOf(`SET ROLE \${quote(db.owner)}`),
      );
      expect(script.indexOf('"RESET ROLE"')).toBeLessThan(
        script.indexOf("connect(db.database, db.owner"),
      );
    }
  });

  it("migrates over the transport JEEVES_MIGRATE_TLS names, which PGSSLMODE can't change (QG29)", () => {
    const processes = assembleV2(
      {
        designJson: JSON.stringify(
          runStudioCommands(withStubWorkloads(stubStackDesign()), [
            { type: "setRunnableProcesses", on: true },
          ]),
        ),
      },
      loadApplicationRegistry(),
    );
    for (const bundle of [emit(), processes]) {
      const script = text(bundle, "scripts/migrate.mjs");
      expect(script).toContain('import { checkServerIdentity } from "node:tls";\n');
      // Every transport variable is read once, in `migrationSsl`, before the first connection.
      const read = script.indexOf("const ssl = migrationSsl();\n");
      expect(script.match(/migrationSsl\(\)/g)).toHaveLength(2);
      expect(read).toBeGreaterThan(script.indexOf("function migrationSsl() {"));
      expect(read).toBeLessThan(script.indexOf("connect("));
      expect(read).toBeLessThan(script.indexOf("const connect = "));
      for (const name of [
        "JEEVES_REQUIRE_TLS",
        "NODE_TLS_REJECT_UNAUTHORIZED",
        "JEEVES_MIGRATE_TLS",
        "JEEVES_MIGRATE_TLS_SERVERNAME",
        "JEEVES_MIGRATE_CA_FILE",
      ]) {
        const reads = [...script.matchAll(new RegExp(`process\\.env\\.${name}\\b`, "g"))];
        expect([name, reads.length]).toEqual([name, 1]);
        expect(reads[0]?.index).toBeLessThan(read);
      }
      expect(script).not.toMatch(/process\.env\.PGSSL/);
      // Every connection (admin, owner, runtime-login check) is the one `pg.Client`, given `ssl`.
      expect(script.match(/new pg\.Client\(/g)).toHaveLength(1);
      expect(script).toContain("    port: Number(process.env.PGPORT ?? 5432),\n    ssl,\n");
      const compose = JSON.parse(text(bundle, "compose.yaml"));
      expect(compose.services["setup-migrate"].environment.JEEVES_MIGRATE_TLS).toBe("disable");
      // No process reads them: only the migration's setup service has one.
      for (const [name, service] of Object.entries(compose.services))
        expect([name, JSON.stringify(service).includes("JEEVES_MIGRATE_")]).toEqual([
          name,
          name === "setup-migrate",
        ]);
      for (const file of bundle.files.filter((f) => f.path.startsWith("src/")))
        expect([
          file.path,
          new TextDecoder().decode(file.bytes).includes("JEEVES_MIGRATE_"),
        ]).toEqual([file.path, false]);
    }
    // With processes on, the product step's three anchors are still substituted.
    const product = text(processes, "scripts/migrate.mjs");
    expect(product).toContain(
      'import { hash, plan, quote, secret } from "./common.mjs";\nimport { applyProductSql, grantProductSql } from "./products.mjs";\n',
    );
    expect(product).toContain("      await applyProductSql(owner, db, quote);\n");
    expect(product).toContain(
      '      await grantProductSql(owner, db, runtime, quote);\n      await owner.query("COMMIT");\n',
    );

    // The emitted script, with a stand-in `pg` whose Client prints its `ssl` and refuses to connect.
    const registry = loadApplicationRegistry();
    const frozenDesign = offDesigns(registry)["frozen-v2"];
    if (frozenDesign === undefined) throw new Error("frozen-v2 is one of the pinned designs");
    const frozen = assembleV2({ designJson: frozenDesign }, registry);
    const dir = mkdtempSync(join(tmpdir(), "jeeves-qg29-"));
    try {
      for (const path of ["scripts/migrate.mjs", "scripts/common.mjs"]) {
        mkdirSync(dirname(join(dir, path)), { recursive: true });
        writeFileSync(join(dir, path), text(frozen, path));
      }
      mkdirSync(join(dir, "infra"));
      writeFileSync(join(dir, "infra/local.json"), "{}");
      mkdirSync(join(dir, "secrets"));
      writeFileSync(join(dir, "secrets/postgres-admin"), randomUUID());
      mkdirSync(join(dir, "node_modules/pg"), { recursive: true });
      writeFileSync(
        join(dir, "node_modules/pg/package.json"),
        JSON.stringify({ name: "pg", type: "module", exports: "./index.js" }),
      );
      writeFileSync(
        join(dir, "node_modules/pg/index.js"),
        [
          "class Client {",
          "  constructor({ ssl }) {",
          "    const shown = ssl && typeof ssl === 'object' && 'checkServerIdentity' in ssl",
          "      ? { ...ssl, checkServerIdentity: typeof ssl.checkServerIdentity }",
          "      : ssl;",
          "    console.log(JSON.stringify({ ssl: shown }));",
          "  }",
          "  connect() { return Promise.reject(new Error('stop')); }",
          "}",
          "export default { Client };",
        ].join("\n"),
      );
      const caText = `test CA ${randomUUID()}\n`;
      writeFileSync(join(dir, "ca.pem"), caText);
      const run = (variables: Record<string, string>) => {
        const result = spawnSync(process.execPath, [join(dir, "scripts/migrate.mjs")], {
          encoding: "utf8",
          env: { SECRET_DIR: join(dir, "secrets"), ...variables },
        });
        expect(result.status).toBe(1);
        return result;
      };
      const connects = (variables: Record<string, string>, ssl: unknown) => {
        const result = run(variables);
        expect([variables, result.stdout]).toEqual([variables, `${JSON.stringify({ ssl })}\n`]);
        expect(result.stderr).toContain("Error: stop\n");
      };
      const fails = (variables: Record<string, string>, message: string) => {
        const result = run(variables);
        expect([variables, result.stdout]).toEqual([variables, ""]);
        expect(result.stderr).toContain(`Error: ${message}\n`);
        expect(result.stderr).not.toContain("missing-ca");
      };
      connects({ JEEVES_MIGRATE_TLS: "disable" }, false);
      connects({ JEEVES_MIGRATE_TLS: "disable", PGSSLMODE: "require" }, false);
      connects({ JEEVES_MIGRATE_TLS: "verify-full" }, { rejectUnauthorized: true });
      connects(
        { JEEVES_MIGRATE_TLS: "verify-full", PGSSLMODE: "disable" },
        { rejectUnauthorized: true },
      );
      connects(
        { JEEVES_MIGRATE_TLS: "verify-full", JEEVES_MIGRATE_CA_FILE: join(dir, "ca.pem") },
        { rejectUnauthorized: true, ca: caText },
      );
      connects(
        { JEEVES_MIGRATE_TLS: "verify-full", JEEVES_MIGRATE_TLS_SERVERNAME: "db.internal" },
        { rejectUnauthorized: true, servername: "db.internal", checkServerIdentity: "function" },
      );
      fails({}, "Invalid endpoint JEEVES_MIGRATE_TLS");
      fails({ JEEVES_MIGRATE_TLS: "require" }, "Invalid endpoint JEEVES_MIGRATE_TLS");
      fails(
        { JEEVES_MIGRATE_TLS: "verify-full", JEEVES_MIGRATE_TLS_SERVERNAME: "db internal" },
        "Invalid endpoint JEEVES_MIGRATE_TLS_SERVERNAME",
      );
      fails(
        { JEEVES_MIGRATE_TLS: "verify-full", JEEVES_MIGRATE_CA_FILE: join(dir, "missing-ca.pem") },
        "Unreadable CA file JEEVES_MIGRATE_CA_FILE (ENOENT)",
      );
      // The switch (QG10, with QG30's rule).
      const strict = { JEEVES_REQUIRE_TLS: "true" };
      fails({ ...strict, JEEVES_MIGRATE_TLS: "disable" }, "Insecure endpoint JEEVES_MIGRATE_TLS");
      connects({ ...strict, JEEVES_MIGRATE_TLS: "disable", PGHOST: "/cloudsql/p:r:i" }, false);
      connects({ ...strict, JEEVES_MIGRATE_TLS: "verify-full" }, { rejectUnauthorized: true });
      fails(
        { ...strict, JEEVES_MIGRATE_TLS: "verify-full", NODE_TLS_REJECT_UNAUTHORIZED: "0" },
        "Insecure endpoint NODE_TLS_REJECT_UNAUTHORIZED",
      );
      fails(
        { JEEVES_REQUIRE_TLS: "TRUE", JEEVES_MIGRATE_TLS: "verify-full" },
        "Invalid endpoint JEEVES_REQUIRE_TLS",
      );
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("reads a credential from the file JEEVES_SECRET_<NAME>_FILE names, else SECRET_DIR (QG34)", async () => {
    const processes = assembleV2(
      {
        designJson: JSON.stringify(
          runStudioCommands(withStubWorkloads(stubStackDesign()), [
            { type: "setRunnableProcesses", on: true },
          ]),
        ),
      },
      loadApplicationRegistry(),
    );
    for (const bundle of [emit(), processes]) {
      // Compose sets none of the variables, and only the README's one sentence names them.
      expect(text(bundle, "compose.yaml")).not.toContain("JEEVES_SECRET_");
      expect(text(bundle, ".jeeves/report.json")).not.toContain("JEEVES_SECRET_");
      const readme = text(bundle, "README.md");
      expect(readme).toContain(
        "A credential is read from `JEEVES_SECRET_<NAME>_FILE` when that is set (an absolute path; `<NAME>` is the secret's name upper-cased, with `-` and `.` as `_`), else from `SECRET_DIR/<name>` (`/run/secrets/<name>`, where Compose mounts it).",
      );
      expect(readme.match(/JEEVES_SECRET_/g)).toHaveLength(1);
    }

    const name = "sql-links--redirect-service";
    const variable = "JEEVES_SECRET_SQL_LINKS__REDIRECT_SERVICE_FILE";
    const dir = mkdtempSync(join(tmpdir(), "jeeves-qg34-"));
    const fromDirectory = randomUUID();
    const fromFile = randomUUID();
    const mounted = join(dir, "credentials", name, "value");
    const missing = join(dir, "credentials", "missing", "value");
    const saved = { SECRET_DIR: process.env.SECRET_DIR };
    try {
      mkdirSync(join(dir, "secrets"));
      writeFileSync(join(dir, "secrets", name), `${fromDirectory}\n`);
      mkdirSync(dirname(mounted), { recursive: true });
      writeFileSync(mounted, `${fromFile}\n`);

      // `readSecret`, from the emitted `src/runtime/local.ts`, type-stripped.
      const local = stripTypeScriptTypes(text(processes, "src/runtime/local.ts"));
      const { readSecret } = await import(
        `data:text/javascript;base64,${Buffer.from(local).toString("base64")}`
      );
      const read = (variables: Record<string, string>, secret = name) => {
        const set = { SECRET_DIR: join(dir, "secrets"), ...variables };
        Object.assign(process.env, set);
        try {
          return { value: readSecret(secret) };
        } catch (error) {
          return { error: (error as Error).message };
        } finally {
          for (const key of Object.keys(set)) delete process.env[key];
        }
      };
      expect(read({})).toEqual({ value: fromDirectory });
      expect(read({ [variable]: mounted })).toEqual({ value: fromFile });
      expect(read({ JEEVES_SECRET_CACHE_HOT_FILE: mounted }, "cache.hot")).toEqual({
        value: fromFile,
      });
      expect(read({ [variable]: "credentials/value" })).toEqual({
        error: `Invalid endpoint ${variable}`,
      });
      expect(read({ [variable]: `${mounted}\n` })).toEqual({
        error: `Invalid endpoint ${variable}`,
      });
      expect(read({ [variable]: missing })).toEqual({
        error: `Unreadable secret file ${variable} (ENOENT)`,
      });
      // The name rule comes first: the variable this name would have is never read.
      expect(read({ JEEVES_SECRET_SQL_LINKS_FILE: "relative" }, "Sql-links")).toEqual({
        error: "Invalid secret identity",
      });

      // `secret`, from the emitted `scripts/common.mjs`, in a child `node` with only each case's
      // variables.
      mkdirSync(join(dir, "scripts"));
      writeFileSync(join(dir, "scripts/common.mjs"), text(processes, "scripts/common.mjs"));
      mkdirSync(join(dir, "infra"));
      writeFileSync(join(dir, "infra/local.json"), "{}");
      const common = pathToFileURL(join(dir, "scripts/common.mjs")).href;
      const secret = (variables: Record<string, string>) => {
        const run = spawnSync(
          process.execPath,
          [
            "--input-type=module",
            "-e",
            [
              `const { secret } = await import(${JSON.stringify(common)});`,
              `try { console.log(JSON.stringify({ value: secret(${JSON.stringify(name)}) })); }`,
              "catch (error) { console.log(JSON.stringify({ error: error.message })); }",
            ].join("\n"),
          ],
          { encoding: "utf8", env: { SECRET_DIR: join(dir, "secrets"), ...variables } },
        );
        expect(run.status, run.stderr).toBe(0);
        return JSON.parse(run.stdout);
      };
      expect(secret({})).toEqual({ value: fromDirectory });
      expect(secret({ [variable]: mounted })).toEqual({ value: fromFile });
      expect(secret({ [variable]: "credentials/value" })).toEqual({
        error: `Invalid endpoint ${variable}`,
      });
      expect(secret({ [variable]: `${mounted}\n` })).toEqual({
        error: `Invalid endpoint ${variable}`,
      });
      expect(secret({ [variable]: missing })).toEqual({
        error: `Unreadable secret file ${variable} (ENOENT)`,
      });
    } finally {
      if (saved.SECRET_DIR === undefined) delete process.env.SECRET_DIR;
      else process.env.SECRET_DIR = saved.SECRET_DIR;
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

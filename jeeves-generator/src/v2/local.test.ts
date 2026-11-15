import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { pathToFileURL } from "node:url";
import { designSchema, generationRuntime } from "@jeeves/spec";
import { describe, expect, it } from "vitest";
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
          runStudioCommands(stubStackDesign(), [{ type: "setRunnableProcesses", on: true }]),
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
          runStudioCommands(stubStackDesign(), [{ type: "setRunnableProcesses", on: true }]),
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
          runStudioCommands(stubStackDesign(), [{ type: "setRunnableProcesses", on: true }]),
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
        "COPY infra ./infra",
        "USER node",
        'CMD ["node", "scripts/status.mjs"]',
      ]);
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
    expect(text(processes, "src/runtime/process.ts")).toContain(
      'const marker = "/tmp/application-ready";',
    );
  });

  it("sets each secret's mode after writing it, so the host umask can't narrow it (QG22)", () => {
    const processes = assembleV2(
      {
        designJson: JSON.stringify(
          runStudioCommands(stubStackDesign(), [{ type: "setRunnableProcesses", on: true }]),
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

  it("migrates one copy at a time and completes with a non-superuser admin", () => {
    const processes = assembleV2(
      {
        designJson: JSON.stringify(
          runStudioCommands(stubStackDesign(), [{ type: "setRunnableProcesses", on: true }]),
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
});

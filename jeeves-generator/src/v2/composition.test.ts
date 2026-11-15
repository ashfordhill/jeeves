import { randomUUID } from "node:crypto";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { stripTypeScriptTypes } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  applyOperations,
  buildGenerationPresetCommand,
  designSchema,
  generationExportBlockers,
  generationPresets,
  resolveGeneration,
} from "@jeeves/spec";
import { describe, expect, it } from "vitest";
import { tinyurlStudioExample } from "../../../jeeves/packages/spec/src/studio-examples/tinyurl.ts";
import { createProductAttachmentExample } from "../../examples/product-attachment/recipe.ts";
import { loadLocalV2Registry } from "../../templates/local-v2/index.ts";
import { assembleV2 } from "./assemble.ts";

const empty = () =>
  designSchema.parse({ schemaVersion: 2, revision: 0, elements: [], connections: [] });
function attach(design = empty(), preset: "video" | "youtube" = "youtube", prefix?: string) {
  const result = applyOperations(
    design,
    buildGenerationPresetCommand(design, { preset, prefix }).ops,
  );
  if (!result.ok) throw Error(JSON.stringify(result.errors));
  return result.design;
}
function required<T>(value: T | null | undefined): T {
  if (value === undefined || value === null) throw Error("Missing fixture value");
  return value;
}
const registry = loadLocalV2Registry();
const read = (bundle: ReturnType<typeof assembleV2>, path: string) =>
  new TextDecoder().decode(bundle.files.find((f) => f.path === path)?.bytes);
describe("reusable composition before product completion", () => {
  it("exports reusable mechanisms from a saved product design and leaves every product implementation custom", () => {
    const design = attach();
    const before = structuredClone(design);
    expect(generationExportBlockers(design, registry.installed)).toEqual([]);
    expect(resolveGeneration(design, registry.installed).findings).toHaveLength(4);
    // The video preset stays installed for designs that attached it; nothing attaches it now.
    expect(registry.installed.presets).toEqual([generationPresets.video.ref]);
    expect(registry.installed.templates).toHaveLength(10);
    const a = assembleV2({ designJson: JSON.stringify(design) }, registry);
    expect(design).toEqual(before);
    expect(a.report.applicationComplete).toBe(false);
    expect(a.report.selections.filter((s) => s.status === "unfinished")).toHaveLength(3);
    expect(a.report.gaps.filter((g) => g.required)).toHaveLength(9);
    const plan = JSON.parse(read(a, "infra/local.json"));
    expect(plan.application).toEqual([]);
    expect(plan.identity[0].roles).toEqual([]);
    expect(plan.search).toEqual([]);
    expect(
      a.files.some((f) =>
        /src\/(adapters|services)\/|public-video|video-paths|infra\/edge/.test(f.path),
      ),
    ).toBe(false);
    expect(
      registry.sources.some(
        (s) =>
          /youtube|public-video|video-paths/.test(s.path) && s.path.startsWith("jeeves-generator/"),
      ),
    ).toBe(false);
    expect(read(a, "src/features/video-runtime.ts")).toContain('["ffmpeg", "ffprobe"]');
    expect(read(a, "src/features/service-resources.ts")).toContain(
      'ttlSeconds: input(s, "cache.ttlSeconds")',
    );
    const changed = structuredClone(design);
    const studio = required(changed.architecture?.studio);
    const tile = required(studio.elements.find((e) => e.element === "metadata-cache"));
    if (tile.settings.kind !== "cache") throw Error();
    tile.settings.ttlSeconds = 120;
    const mirror = required(studio.components?.find((c) => c.id === "watch-cache-reader"));
    if (mirror.settings.kind !== "cache-reader") throw Error();
    mirror.settings.l2TtlSeconds = 120;
    const edited = assembleV2({ designJson: JSON.stringify(changed) }, registry);
    expect(read(edited, "src/features/application-bindings.ts")).toContain(
      '"cache.ttlSeconds":120',
    );
  });
  it("attaches base graph/modules/ownership without search/count product choices and preserves existing nodes", () => {
    const existing = tinyurlStudioExample().design;
    const design = attach(existing, "video", "catalog"),
      bundle = assembleV2({ designJson: JSON.stringify(design) }, registry);
    expect(design.elements.some((e) => e.id === required(existing.elements[0]).id)).toBe(true);
    expect(design.elements).toHaveLength(existing.elements.length + 9);
    if (design.schemaVersion !== 3 || !design.generation || !design.ownership) throw Error();
    expect(design.generation.selections.map((s) => s.binding.kind)).toEqual([
      "owned-multipart",
      "asset-lifecycle",
      "video-hls",
    ]);
    expect(required(design.generation.selections[1]).binding).not.toHaveProperty("publication");
    expect(design.ownership.roles).toHaveLength(4);
    expect(JSON.parse(read(bundle, "infra/local.json")).application).toEqual([]);
    expect(JSON.parse(read(bundle, "infra/local.json")).identity[0].roles).toEqual([]);
    expect(bundle.report.applicationComplete).toBe(false);
    expect(
      bundle.files.some(
        (f) =>
          f.path.includes("youtube") ||
          f.path.includes("search-query") ||
          f.path.includes("counter-worker"),
      ),
    ).toBe(false);
    expect(() => attach(design, "video", "catalog")).toThrow();
  });
  it("composes the product attachment through the default registry without YouTube/search/count dependencies", () => {
    const design = attach(empty(), "video", "fitting");
    const productRegistry = loadLocalV2Registry([createProductAttachmentExample()]);
    const bundle = assembleV2({ designJson: JSON.stringify(design) }, productRegistry);
    expect(bundle.report.applicationComplete).toBe(true);
    expect(bundle.report.gaps).toEqual([]);
    const plan = JSON.parse(read(bundle, "infra/local.json"));
    expect(plan.application).toHaveLength(3);
    expect(plan.search).toEqual([]);
    expect(plan.identity[0].roles).toEqual([]);
    expect(plan.logins).toHaveLength(2);
    expect(plan.logins.every((l: { resource: string }) => l.resource.startsWith("fitting-"))).toBe(
      true,
    );
    expect(bundle.files.some((f) => /youtube|counter|search/.test(f.path))).toBe(false);
    expect(read(bundle, "src/examples/product.ts")).toContain("productId");
    expect(read(bundle, "src/examples/product-bindings.ts")).toContain("attachment_private");
    for (const file of bundle.files.filter((f) => f.path.startsWith("src/")))
      expect(new TextDecoder().decode(file.bytes)).not.toMatch(/from ["'][^"']*youtube/);
  });
  it("refuses disconnected saved bindings and preserves unsupported historic protocol intent", () => {
    const design = attach();
    if (design.schemaVersion !== 3 || !design.generation || !design.ownership) throw Error();
    const selected = required(
      design.generation.selections.find((s) => s.binding.kind === "youtube-upload"),
    );
    if (selected.binding.kind !== "youtube-upload") throw Error();
    selected.target = { kind: "element", element: "watch" };
    expect(() => assembleV2({ designJson: JSON.stringify(design) }, registry)).toThrow();
    const historic = attach();
    const connection = required(historic.connections[0]);
    connection.planned.security = "Service identity";
    const bundle = assembleV2({ designJson: JSON.stringify(historic) }, registry);
    expect(bundle.report.applicationComplete).toBe(false);
    expect(connection.planned.security).toBe("Service identity");
  });
  it("keeps unknown identities and a missing runtime blocked while allowing known custom gaps", () => {
    const design = attach();
    if (design.schemaVersion !== 3 || !design.generation?.preset) throw Error();
    expect(
      generationExportBlockers(design, { ...registry.installed, runtime: undefined }),
    ).toContainEqual(expect.objectContaining({ target: { path: ["generation", "runtime"] } }));
    design.generation.preset.sha256 = "0".repeat(64);
    expect(generationExportBlockers(design, registry.installed)).toContainEqual(
      expect.objectContaining({ target: { path: ["generation", "preset"] } }),
    );
    const unknown = attach();
    if (unknown.schemaVersion !== 3 || !unknown.generation) throw Error();
    const index = unknown.generation.selections.findIndex(
      (selection) => selection.binding.kind === "youtube-watch",
    );
    required(unknown.generation.selections[index]).template.sha256 = "0".repeat(64);
    expect(generationExportBlockers(unknown, registry.installed)).toContainEqual(
      expect.objectContaining({
        target: { path: ["generation", "selections", index, "template"] },
      }),
    );
  });
  /** The exact emitted service-resources.ts; its imports are fakes, the pool is a real
   * EventEmitter, and a publisher or consumer answers the binding it was given. */
  async function emittedResources() {
    const bundle = assembleV2({ designJson: JSON.stringify(attach()) }, registry);
    const fakes: Record<string, string> = {
      "./application-bindings.ts": "export const selections = [];",
      "./local-bindings.ts":
        'export const localLogins = [{ resource: "state-db", host: "worker", user: "r" }];',
      "../runtime/postgres.ts": `import { EventEmitter } from "node:events";
        export const createPostgres = (options) =>
          Object.assign(new EventEmitter(), { options, end: async () => {} });`,
      "../runtime/objects.ts": "export const createObjects = () => {};",
      "../runtime/amqp.ts":
        "export const createConsumer = (binding) => ({ binding }), createPublisher = (binding) => ({ binding });",
      "../runtime/positive-cache.ts": "export const createPositiveReader = () => {};",
      // A CA file is read as the pool is built (QG10).
      "node:fs": 'export { readFileSync } from "node:fs";',
    };
    const dataUrl = (js: string) =>
      `data:text/javascript;base64,${Buffer.from(js).toString("base64")}`;
    const js = stripTypeScriptTypes(read(bundle, "src/features/service-resources.ts")).replace(
      /from "([^"]+)"/g,
      (_match, path: string) => `from "${dataUrl(required(fakes[path]))}"`,
    );
    return import(dataUrl(js));
  }
  const counter = {
    id: "counter",
    kind: "event-counter",
    host: "worker",
    inputs: {
      "state.poolSize": 4,
      "state.statementTimeoutMs": 2000,
      "events.mode": "topic",
      "events.retryLimit": 3,
      "host.concurrency": 1,
    },
    resources: { state: "state-db", events: "view-events" },
  };
  /** Sets (or, with undefined, unsets) environment variables for one test. */
  function withEnvironment(values: Record<string, string | undefined>) {
    const saved = Object.fromEntries(Object.keys(values).map((name) => [name, process.env[name]]));
    const set = (entries: Record<string, string | undefined>) => {
      for (const [name, value] of Object.entries(entries))
        if (value === undefined) delete process.env[name];
        else process.env[name] = value;
    };
    set(values);
    return () => set(saved);
  }
  const local = {
    JEEVES_DATABASE_STATE_DB_HOST: "local-postgres",
    JEEVES_DATABASE_STATE_DB_PORT: "5432",
    JEEVES_DATABASE_STATE_DB_TLS: "disable",
    JEEVES_BROKER_HOST: "local-broker",
    JEEVES_BROKER_PORT: "5672",
  };

  it("gives a template's database pool an error listener, so an idle connection's error is not fatal", async () => {
    const resources = await emittedResources();
    const restore = withEnvironment(local);
    try {
      const owned: unknown[] = [];
      const client = resources.pool(
        { own: (drain: unknown) => owned.push(drain) },
        counter,
        "state",
      );
      expect(client.options).toMatchObject({ poolSize: 4, statementTimeoutMs: 2000 });
      expect(owned).toHaveLength(1);
      expect(client.listenerCount("error")).toBe(1);
      // An 'error' with no listener throws, which ends the process; this one is consumed.
      expect(() =>
        client.emit("error", new Error("terminating connection due to administrator command")),
      ).not.toThrow();
    } finally {
      restore();
    }
  });

  it("opens a template's pool and broker at the endpoints its environment names (QG06)", async () => {
    const resources = await emittedResources();
    const scope = { own: () => {} };
    const restore = withEnvironment({
      JEEVES_DATABASE_STATE_DB_HOST: "db.internal",
      JEEVES_DATABASE_STATE_DB_PORT: "6432",
      JEEVES_DATABASE_STATE_DB_TLS: "disable",
      JEEVES_BROKER_HOST: "mq.internal",
      JEEVES_BROKER_PORT: "5673",
    });
    try {
      expect(resources.pool(scope, counter, "state").options).toMatchObject({
        hostname: "db.internal",
        port: 6432,
      });
      // A Unix socket directory is a database host too.
      process.env.JEEVES_DATABASE_STATE_DB_HOST = "/cloudsql/p:r:i";
      expect(resources.pool(scope, counter, "state").options.hostname).toBe("/cloudsql/p:r:i");
      const broker = {
        hostname: "mq.internal",
        port: 5673,
        username: "runtime",
        passwordSecret: "broker-password",
        heartbeatSeconds: 10,
        confirmTimeoutMs: 5000,
      };
      // What a mounted template's loop passes to loopConsumer, and its publisher and consumer.
      expect(resources.brokerBinding()).toEqual(broker);
      expect(resources.publisher(counter, "events", scope).binding).toEqual(broker);
      expect(resources.consumer(counter, "events", async () => {}).binding).toEqual(broker);
    } finally {
      restore();
    }
  });

  it("fails a template's pool or broker naming its missing or invalid variable, never the value", async () => {
    const resources = await emittedResources();
    const cases: [Record<string, string | undefined>, string][] = [
      [{ JEEVES_DATABASE_STATE_DB_HOST: undefined }, "JEEVES_DATABASE_STATE_DB_HOST"],
      [{ JEEVES_DATABASE_STATE_DB_HOST: "db internal" }, "JEEVES_DATABASE_STATE_DB_HOST"],
      [{ JEEVES_DATABASE_STATE_DB_PORT: "65536" }, "JEEVES_DATABASE_STATE_DB_PORT"],
      // A socket directory is a database's only: the broker's host is a name or an address.
      [{ JEEVES_BROKER_HOST: "/var/run/rabbitmq" }, "JEEVES_BROKER_HOST"],
      [{ JEEVES_BROKER_PORT: undefined }, "JEEVES_BROKER_PORT"],
    ];
    for (const [values, variable] of cases) {
      const restore = withEnvironment({ ...local, ...values });
      try {
        const build = variable.startsWith("JEEVES_DATABASE")
          ? () => resources.pool({ own: () => {} }, counter, "state")
          : () => resources.publisher(counter, "events", { own: () => {} });
        expect(build).toThrow(new Error(`Invalid endpoint ${variable}`));
        for (const value of Object.values(values))
          if (value) expect(() => build()).not.toThrow(value);
      } finally {
        restore();
      }
    }
  });

  it("gives a template's pool its transport, and refuses a plain-text one under JEEVES_REQUIRE_TLS (QG10)", async () => {
    const resources = await emittedResources();
    const scope = { own: () => {} };
    const directory = mkdtempSync(join(tmpdir(), "jeeves-qg10-"));
    const caFile = join(directory, "ca.pem");
    const caText = `test CA ${randomUUID()}\n`;
    writeFileSync(caFile, caText);
    const name = (part: string) => `JEEVES_DATABASE_STATE_DB_${part}`;
    const tls = (values: Record<string, string | undefined>) => {
      const restore = withEnvironment({
        ...local,
        [name("CA_FILE")]: undefined,
        [name("TLS_SERVERNAME")]: undefined,
        JEEVES_REQUIRE_TLS: undefined,
        ...values,
      });
      try {
        return resources.pool(scope, counter, "state").options.tls;
      } catch (error) {
        return (error as Error).message;
      } finally {
        restore();
      }
    };
    try {
      expect(tls({})).toEqual({ mode: "disable" });
      expect(tls({ [name("TLS")]: "verify-full" })).toEqual({ mode: "verify-full" });
      expect(
        tls({
          [name("TLS")]: "verify-full",
          [name("CA_FILE")]: caFile,
          [name("TLS_SERVERNAME")]: "state.example",
        }),
      ).toEqual({ mode: "verify-full", ca: caText, servername: "state.example" });
      // Each failure names its variable, never its value.
      const missing = join(directory, "missing.pem");
      expect([
        tls({ [name("TLS")]: undefined }),
        tls({ [name("TLS")]: "require" }),
        tls({ [name("TLS")]: "verify-full", [name("TLS_SERVERNAME")]: "state example" }),
        tls({ [name("TLS")]: "verify-full", [name("CA_FILE")]: missing }),
        tls({ JEEVES_REQUIRE_TLS: "yes" }),
        tls({ JEEVES_REQUIRE_TLS: "true" }),
      ]).toEqual([
        `Invalid endpoint ${name("TLS")}`,
        `Invalid endpoint ${name("TLS")}`,
        `Invalid endpoint ${name("TLS_SERVERNAME")}`,
        `Unreadable CA file ${name("CA_FILE")} (ENOENT)`,
        "Invalid endpoint JEEVES_REQUIRE_TLS",
        `Insecure endpoint ${name("TLS")}`,
      ]);
      // Under the switch, verified TLS passes, and so does a Unix socket directory (local transport).
      expect(tls({ JEEVES_REQUIRE_TLS: "true", [name("TLS")]: "verify-full" })).toEqual({
        mode: "verify-full",
      });
      expect(tls({ JEEVES_REQUIRE_TLS: "true", [name("HOST")]: "/cloudsql/p:r:i" })).toEqual({
        mode: "disable",
      });
      // Under the switch, Node's verification override must be unset or 1 (QG30).
      expect(
        tls({
          JEEVES_REQUIRE_TLS: "true",
          [name("TLS")]: "verify-full",
          NODE_TLS_REJECT_UNAUTHORIZED: "0",
        }),
      ).toBe("Insecure endpoint NODE_TLS_REJECT_UNAUTHORIZED");
      expect(
        tls({
          JEEVES_REQUIRE_TLS: "true",
          [name("TLS")]: "verify-full",
          NODE_TLS_REJECT_UNAUTHORIZED: "1",
        }),
      ).toEqual({ mode: "verify-full" });
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
});

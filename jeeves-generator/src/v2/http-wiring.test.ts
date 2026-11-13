import { type DesignDocument, emptyDesign, type StudioCommand } from "@jeeves/spec";
import { describe, expect, it } from "vitest";
import {
  signIn,
  signInStackCommands,
  signInStackDesign,
} from "../../../jeeves/packages/spec/src/fixtures/sign-in-stack.ts";
import {
  stubStackDesign,
  stubStackWithCacheRead,
} from "../../../jeeves/packages/spec/src/fixtures/stub-stack.ts";
import {
  moduleAuthored,
  runStudioCommands,
  tileLevelTwin,
} from "../../../jeeves/packages/spec/src/fixtures/v2-modules.ts";
import { loadLocalV2Registry } from "../../templates/local-v2/index.ts";
import { canonicalJson } from "../json.ts";
import { assembleV2 } from "./assemble.ts";

const registry = loadLocalV2Registry();
const on: StudioCommand = { type: "setRunnableProcesses", on: true };
const assemble = (design: DesignDocument) =>
  assembleV2({ designJson: canonicalJson(design) }, registry);
type Bundle = ReturnType<typeof assemble>;
const text = (bundle: Bundle, path: string) => {
  const file = bundle.files.find((item) => item.path === path);
  if (!file) throw new Error(`Missing ${path}`);
  return new TextDecoder().decode(file.bytes);
};
const json = (bundle: Bundle, path: string) => JSON.parse(text(bundle, path));
type Row = {
  tile: string;
  edge?: string;
  routes: { method: string; path: string; answers: string }[];
  templates: { selection: string; template: string; level: string }[];
  hooks: { selection: string; file: string; hooks: string[] }[];
};
const rows = (bundle: Bundle) =>
  (bundle.report as unknown as { processes: { runnable: boolean; tiles: Row[] } }).processes;
const routes = (bundle: Bundle, tile: string) =>
  rows(bundle)
    .tiles.find((row) => row.tile === tile)
    ?.routes.map((route) => `${route.method} ${route.path} → ${route.answers}`);
const gap = (bundle: Bundle, id: string) => bundle.report.gaps.find((item) => item.id === id);

describe("HTTP wiring (tile process contract, sections 2-4)", () => {
  const stack = assemble(runStudioCommands(stubStackWithCacheRead(), [on]));
  const stackOff = assemble(stubStackWithCacheRead());
  const v2 = assemble(runStudioCommands(moduleAuthored(tileLevelTwin(), registry.installed), [on]));
  const v2Off = assemble(moduleAuthored(tileLevelTwin(), registry.installed));

  it("routes every stub, template and placeholder, with what each answers", () => {
    expect(stack.report.findings).toEqual([]);
    expect(rows(stack).runnable).toBe(true);
    const ready = "GET /healthz → 200 once ready, 503 before and while draining";
    const stub = (id: string, name: string) =>
      [`/modules/${id}`, `/modules/${id}/*`].map(
        (path) => `ANY ${path} → 501 "Not implemented: ${name}" until it is written`,
      );
    // Links API's six route stubs, in module order; its Upload consumer is a loop (TP06).
    expect(routes(stack, "links-api")).toEqual([
      ready,
      ...stub("link-reader", "Link reader"),
      ...stub("link-cache", "Link cache"),
      ...stub("limiter", "Limiter"),
      ...stub("visit-publisher", "Visit publisher"),
      ...stub("redirector", "Redirector"),
      ...stub("stats-caller", "Stats caller"),
    ]);
    expect(routes(stack, "stats-api")).toEqual([ready, ...stub("stats-search", "Stats search")]);
    expect(routes(stack, "upload-api")).toEqual([
      ready,
      ...stub("archive-upload", "Archive upload"),
      ...stub("upload-publisher", "Upload publisher"),
    ]);
    expect(routes(stack, "preview-api")).toEqual([
      ready,
      'GET /modules/preview-reader/:key → 501 "Not implemented: key for Preview reader" until its hooks are written',
    ]);
    expect(routes(stack, "visit-worker")).toEqual([]);
    // v2 built from modules: the Creator check's sign-in answers `principal` (V3-06), so a start
    // reaches `validate` first; the cache read reaches `key`, and search query is a placeholder.
    const unknown = "404 UPLOAD_NOT_FOUND until an upload is started";
    expect(routes(v2, "upload")).toEqual([
      ready,
      "GET /modules/upload-auth/me → 200 {signedIn, subject, username} for a signed-in caller; 401 SIGN_IN_REQUIRED for a missing or invalid token",
      'POST /modules/upload-multipart/uploads → 501 "Not implemented: validate for Multipart uploads" until its hooks are written',
      "GET /modules/upload-multipart/uploads → 200 the caller's uploads: none until one is started",
      ...[
        "GET /modules/upload-multipart/uploads/:uploadId",
        "POST /modules/upload-multipart/uploads/:uploadId/parts/:partNumber",
        "POST /modules/upload-multipart/uploads/:uploadId/complete",
        "POST /modules/upload-multipart/uploads/:uploadId/abort",
      ].map((route) => `${route} → ${unknown}`),
    ]);
    expect(routes(v2, "watch")).toEqual([
      ready,
      'GET /modules/watch-cache-reader/:key → 501 "Not implemented: key for Details cache" until its hooks are written',
      ...stub("watch-counts", "View count reader"),
      ...stub("watch-views", "View publisher"),
    ]);
    // Search query reaches its Index writer's mapping first (V3-08).
    expect(routes(v2, "search")).toEqual([
      ready,
      'GET /modules/search-query → 400 SEARCH_QUERY for a bad q or page; 501 "Not implemented: mapping for Index writer" until its hooks are written; then {q, page, pageSize, total, hits}, 20 to a page',
    ]);
    // The HTTP processes' templates; the worker templates run loops (loop-wiring.test.ts).
    expect(
      rows(v2)
        .tiles.filter((row) => row.routes.length)
        .flatMap((row) => row.templates),
    ).toEqual([
      { selection: "search-query", template: "search-query", level: "mounted" },
      { selection: "upload-auth", template: "verified-identity", level: "mounted" },
      { selection: "upload-multipart", template: "owned-multipart", level: "mounted" },
      { selection: "watch-cache-reader", template: "positive-cache-read", level: "mounted" },
    ]);
    // The process mounts each route through its 501 wrapper.
    const links = text(stack, "src/processes/links-api.ts");
    expect(links).toContain(
      'stubRoutes(routes, log, "link-reader", (request) =>\n        linkReader(dependencies["link-reader"], request),\n      );',
    );
    expect(links).toContain(
      'import type { Dependencies as LinkReaderDependencies } from "../modules/links-api/link-reader.slots.ts";',
    );
    // Its Upload consumer is a loop, not a route.
    expect(links).not.toContain('stubRoutes(routes, log, "upload-consumer"');
    expect(
      json(stack, ".jeeves/normalized.json").processes.find(
        (row: { tile: string }) => row.tile === "preview-api",
      ).templates,
    ).toEqual([
      {
        selection: "preview-reader",
        template: { id: "positive-cache-read", version: "0.1.0", sha256: expect.any(String) },
        lead: { module: "preview-reader", name: "Preview reader", kind: "cache-reader" },
      },
    ]);
  });

  it("publishes public HTTP processes through one nginx edge", () => {
    expect(text(stack, "infra/edge/nginx.conf")).toBe(
      [
        "events {}",
        "http {",
        "  access_log off;",
        "  error_log /dev/stderr warn;",
        "  resolver 127.0.0.11 valid=10s;",
        // The edge's own answers are JSON whatever the extension, a process that is down too.
        "  types { }",
        "  default_type application/json;",
        "  server {",
        "    listen 8080;",
        "    error_page 502 504 = @unavailable;",
        `    location = /healthz { return 200 '{"service":"edge","application":"ready"}'; }`,
        ...["links-api", "preview-api", "upload-api"].map(
          (id) =>
            `    location /api/${id}/ { set $backend app-${id}:3000; rewrite ^/api/${id}/(.*)$ /$1 break; proxy_pass http://$backend; }`,
        ),
        `    location @unavailable { return 503 '{"error":"UNAVAILABLE","message":"Service unavailable."}'; }`,
        `    location / { return 404 '{"error":"NOT_FOUND","message":"Route not found."}'; }`,
        "  }",
        "}",
        "",
      ].join("\n"),
    );
    const compose = json(stack, "compose.yaml") as {
      services: Record<string, Record<string, unknown>>;
    };
    const pins = JSON.parse(
      new TextDecoder().decode(
        registry.asset("jeeves-generator/templates/local-v2/assets/providers.json"),
      ),
    );
    expect(compose.services["app-edge"]).toEqual({
      image: pins.nginx,
      profiles: ["application"],
      depends_on: {
        "app-links-api": { condition: "service_healthy" },
        "app-preview-api": { condition: "service_healthy" },
        "app-upload-api": { condition: "service_healthy" },
      },
      ports: [`127.0.0.1:\${LOCAL_HTTP_PORT:?Set LOCAL_HTTP_PORT}:8080`],
      volumes: ["./infra/edge/nginx.conf:/etc/nginx/nginx.conf:ro"],
      healthcheck: {
        test: ["CMD", "wget", "-q", "-O", "/dev/null", "http://127.0.0.1:8080/healthz"],
        interval: "5s",
        timeout: "5s",
        retries: 30,
        start_period: "20s",
      },
    });
    // Only the edge publishes the HTTP port (Garage, provisioned for Archive, its object port);
    // Stats API stays internal.
    expect(
      Object.entries(compose.services)
        .filter(([, service]) => service.ports)
        .map(([name, service]) => `${name} ${service.ports}`),
    ).toEqual([
      `app-edge 127.0.0.1:\${LOCAL_HTTP_PORT:?Set LOCAL_HTTP_PORT}:8080`,
      `local-objects 127.0.0.1:\${LOCAL_OBJECT_PORT:?Set LOCAL_OBJECT_PORT}:3900`,
    ]);
    expect(rows(stack).tiles.map((row) => [row.tile, row.edge])).toEqual([
      ["links-api", "/api/links-api/"],
      ["preview-api", "/api/preview-api/"],
      ["stats-api", undefined],
      ["upload-api", "/api/upload-api/"],
      ["visit-worker", undefined],
    ]);
    expect(json(stack, "infra/local.json").application).toContain("app-edge");
    expect(text(stack, "README.md")).toContain("`app-edge` publishes each public HTTP process");
    const record = stack.manifest.files.find((file) => file.path === "infra/edge/nginx.conf");
    expect(record?.contributors.map((item) => item.emitter.id)).toEqual(["local.tile-processes"]);
    // Off, there is no edge.
    expect(stackOff.files.map((file) => file.path)).not.toContain("infra/edge/nginx.conf");
  });

  it("has no edge without a public HTTP process, and refuses a tile that would take its name", () => {
    // A service behind a gateway isn't a lane entry, so it is internal.
    const internal = runStudioCommands(emptyDesign(), [
      { type: "addAction", lane: "download", name: "Run", system: { name: "Jobs" } },
      {
        type: "addTile",
        from: { lane: "download" },
        side: "after",
        tile: { id: "gateway", name: "Gateway", kind: "gateway" },
        linkId: "download-gateway",
      },
      {
        type: "addTile",
        from: { tile: "gateway" },
        side: "after",
        tile: { id: "jobs", name: "Jobs", kind: "service" },
        linkId: "gateway-jobs",
      },
      { type: "addModule", host: "jobs", kind: "custom", name: "Job" },
      on,
    ]);
    const bundle = assemble(internal);
    expect(rows(bundle).tiles.map((row) => [row.tile, row.edge])).toEqual([["jobs", undefined]]);
    expect(Object.keys(json(bundle, "compose.yaml").services)).toEqual(["app-jobs"]);
    expect(bundle.files.map((file) => file.path)).not.toContain("infra/edge/nginx.conf");
    const edge = runStudioCommands(emptyDesign(), [
      { type: "addAction", lane: "download", name: "Go", system: { name: "Edge" } },
      {
        type: "addTile",
        from: { lane: "download" },
        side: "after",
        tile: { id: "edge", name: "Edge", kind: "service" },
        linkId: "download-edge",
      },
      { type: "addModule", host: "edge", kind: "custom", name: "Thing" },
      on,
    ]);
    expect(() => assemble(edge)).toThrow(/edge's service name/);
  });

  it("gives each mounted lead a hooks file whose hooks throw, and names it in its gap", () => {
    const hooks = text(stack, "src/modules/preview-api/preview-reader.hooks.ts");
    expect(hooks.split("\n").slice(0, 2)).toEqual([
      "// Preview reader (Cache reader) in Preview API: the product hooks its cache read template calls.",
      "// Write them here. Export never overwrites your edits: export afresh and carry them over.",
    ]);
    expect(hooks).toContain(
      "export function previewReaderHooks(resources: PreviewReaderResources): PositiveReadAdapter<PreviewReaderInput, unknown> {",
    );
    for (const hook of ["key", "codec", "eligible", "load", "expiresAt"])
      expect(hooks).toContain(`throw new NotImplemented("${hook} for Preview reader");`);
    const upload = text(v2, "src/modules/upload/upload-multipart.hooks.ts");
    for (const hook of ["validate", "metadata", "response", "originalKey", "job"])
      expect(upload).toContain(`throw new NotImplemented("${hook} for Multipart uploads");`);
    expect(upload).toContain("const upload: UploadHooks<unknown, unknown> = {");
    // V3-06: the tile's sign-in answers `principal`, and the asset lifecycle naming the upload
    // answers `reserve`, `complete` and `closed`; nothing else to write there.
    for (const hook of ["principal", "reserve", "complete", "closed"])
      expect(upload).not.toContain(`throw new NotImplemented("${hook} for Multipart uploads");`);
    expect(upload).toContain("      return resources.guard.require(request);");
    expect(upload).toContain("      return resources.lifecycle.reserve(tx, record);");
    expect(upload).toContain("      return resources.lifecycle.complete(tx, record, original);");
    expect(upload).toContain("      return resources.lifecycle.closed(tx, record, terminal);");
    expect(upload).toContain("  guard: TileGuard;");
    // The worker templates' hooks files are in loop-wiring.test.ts.
    expect(
      v2.files
        .map((file) => file.path)
        .filter((path) => /^src\/modules\/(upload|watch|search)\/.*\.hooks\.ts$/.test(path)),
    ).toEqual([
      "src/modules/search/search-query.hooks.ts",
      "src/modules/upload/upload-multipart.hooks.ts",
      "src/modules/watch/watch-cache-reader.hooks.ts",
    ]);
    const owned = (bundle: Bundle, path: string) =>
      bundle.manifest.files.find((file) => file.path === path)?.ownership;
    expect(owned(v2, "src/modules/upload/upload-multipart.hooks.ts")).toBe("generated-extension");
    expect(
      rows(v2)
        .tiles.filter((row) => row.routes.length)
        .flatMap((row) => row.hooks.map((item) => [item.file, item.hooks.length])),
    ).toEqual([
      ["src/modules/search/search-query.hooks.ts", 2],
      ["src/modules/upload/upload-multipart.hooks.ts", 5],
      ["src/modules/watch/watch-cache-reader.hooks.ts", 5],
    ]);
    expect(gap(v2, "multipart-application-bindings")).toMatchObject({
      status: "custom",
      required: true,
      description:
        'Write the product hooks in src/modules/upload/upload-multipart.hooks.ts; until then each throws "Not implemented" and its route answers 501.',
    });
    expect(gap(stack, "positive-cache-application-bindings")).toMatchObject({
      status: "custom",
      description: expect.stringContaining("src/modules/preview-api/preview-reader.hooks.ts"),
    });
    // Off, the gaps keep their wording, search's too.
    expect(gap(v2Off, "multipart-application-bindings")?.status).toBe("unfinished");
    expect(gap(stackOff, "positive-cache-application-bindings")?.status).toBe("unfinished");
    expect(gap(v2Off, "search-application-bindings")?.status).toBe("unfinished");
    expect(gap(v2, "search-application-bindings")).toMatchObject({
      status: "custom",
      description:
        'Write the product hooks in src/modules/search/search-query.hooks.ts, src/modules/search-indexer/indexer-writer.hooks.ts; until then each throws "Not implemented" and a search answers 501 and each event goes to .failed.',
    });
  });

  it("provisions what the mounted templates use: tables, logins and providers", () => {
    const plan = json(stack, "infra/local.json");
    // The cache read: a source login, no grants (beside the stubs' logins on Links database).
    expect(plan.logins).toContainEqual({
      resource: "previews-db",
      host: "preview-api",
      database: "d_previews_db",
      user: "r_previews_db__preview_api",
      secret: "sql-previews-db--preview-api",
    });
    expect(plan.grants).toEqual([]);
    const services = json(stack, "compose.yaml").services;
    expect(services["app-preview-api"]).toMatchObject({
      depends_on: {
        "cache-previews-cache": { condition: "service_healthy" },
        "local-postgres": { condition: "service_healthy" },
      },
      secrets: ["sql-previews-db--preview-api", "cache-previews-cache"],
    });
    // Links API's stubs use the cache, the database and the broker (client-wiring.test.ts).
    expect(Object.keys(services["app-links-api"].depends_on)).toEqual([
      "cache-links-cache",
      "local-broker",
      "local-postgres",
    ]);
    // Multipart: its private schema with the uploads table and jobs outbox, granted to its host.
    // The asset lifecycle shares the schema and the outbox, which also carries its publication.
    const v2Plan = json(v2, "infra/local.json");
    expect(
      v2Plan.grants
        .filter((item: { host: string }) => item.host === "upload")
        .map(
          (item: { host: string; schema: string; relation: string; privileges: string[] }) =>
            `${item.host} ${item.schema}.${item.relation} ${item.privileges.join(",")}`,
        ),
    ).toEqual([
      "upload upload_multipart.assets SELECT,INSERT,UPDATE",
      "upload upload_multipart.uploads SELECT,INSERT,UPDATE",
      "upload upload_multipart.outbox SELECT,INSERT,UPDATE",
    ]);
    const sql = text(v2, "infra/postgres/metadata-db/100-upload-multipart.sql");
    expect(sql).toContain('CREATE TABLE "upload_multipart"."uploads" (');
    expect(sql).toContain('CREATE TABLE "upload_multipart"."outbox" (');
    expect(sql).toContain("destination IN ('jobs','publication')");
    expect(json(v2, "compose.yaml").services["app-upload"]).toMatchObject({
      depends_on: {
        "identity-identity": { condition: "service_healthy" },
        "local-broker": { condition: "service_healthy" },
        "local-objects": { condition: "service_healthy" },
        "local-postgres": { condition: "service_healthy" },
      },
      secrets: ["sql-metadata-db--upload", "s3-upload", "broker-password"],
      environment: {
        OBJECT_PUBLIC_ENDPOINT: `http://127.0.0.1:\${LOCAL_OBJECT_PORT:?Set LOCAL_OBJECT_PORT}`,
      },
    });
    const watch = text(v2, "src/processes/watch.ts");
    expect(watch).toContain('const source = pool(scope, s, "source");');
    expect(watch).toContain('await watchCacheReader.source.query("SELECT 1");');
    const upload = text(v2, "src/processes/upload.ts");
    expect(upload).toContain("await uploadMultipart.multipart.sweep();");
    expect(upload).toContain(
      'periodic(scope, () => uploadMultipart.multipart.sweep(), 30000, (error) => failure("sweep upload-multipart", error));',
    );
    // Each template's `started` line comes after listening and its periodic work, before ready.
    const tail = (source: string) =>
      source.slice(source.indexOf("await service.start(config.listen);"));
    expect(tail(upload).split("\n").slice(1)).toEqual([
      '  periodic(scope, () => uploadMultipart.multipart.sweep(), 30000, (error) => failure("sweep upload-multipart", error));',
      '  logStarted(config.tile, {"module":"upload-auth","template":"verified-identity","wiring":"mounted","checks":["sign-in Required on every module route"]});',
      '  logStarted(config.tile, {"module":"upload-multipart","template":"owned-multipart","wiring":"mounted","checks":["jobs publisher open","outbox relay started","SELECT 1 on its state login","sweep at start","sweep every 30 s"]});',
      "  scope.ready();",
      "});",
      "",
    ]);
    expect(tail(watch)).toContain(
      'logStarted(config.tile, {"module":"watch-cache-reader","template":"positive-cache-read","wiring":"mounted","checks":["SELECT 1 on its source login"]});',
    );
    expect(tail(text(v2, "src/processes/search.ts"))).toContain(
      'logStarted(config.tile, {"module":"search-query","template":"search-query","wiring":"mounted","checks":["cluster health","index search-index asserted once its mapping is written"]});',
    );
  });

  it("mounts each tile's sign-in, Required or Optional, and provisions Keycloak for it (V3-06)", () => {
    const bundle = assemble(signInStackDesign());
    expect(bundle.report.findings).toEqual([]);
    expect(rows(bundle).runnable).toBe(true);
    const ready = "GET /healthz → 200 once ready, 503 before and while draining";
    expect(routes(bundle, "watch-api")).toEqual([
      ready,
      "GET /modules/viewer-check/me → 200 {signedIn, subject, username} for a signed-in caller or {signedIn: false} without a token; 401 SIGN_IN_REQUIRED for an invalid token",
      'ANY /modules/hello → 501 "Not implemented: Hello" until it is written',
      'ANY /modules/hello/* → 501 "Not implemented: Hello" until it is written',
    ]);
    expect(routes(bundle, "upload-api")?.slice(0, 3)).toEqual([
      ready,
      "GET /modules/creator-check/me → 200 {signedIn, subject, username} for a signed-in caller; 401 SIGN_IN_REQUIRED for a missing or invalid token",
      'POST /modules/multipart-uploads/uploads → 501 "Not implemented: validate for Multipart uploads" until its hooks are written',
    ]);
    // Every module route of the tile goes through its sign-in; the stub's request gets the caller.
    const watch = text(bundle, "src/processes/watch-api.ts");
    expect(watch).toContain(
      '    configure: (open) => {\n      // Every module route checks its caller first: the tile\'s sign-in.\n      const routes = viewerCheck.routes(open);\n      viewerCheck.me(routes, "/modules/viewer-check/me");',
    );
    expect(watch).toContain(
      '      stubRoutes(\n        routes,\n        log,\n        "hello",\n        (request) => hello(dependencies["hello"], request),\n        viewerCheck.caller,\n      );',
    );
    expect(watch).toContain('      "signIn": "optional",');
    expect(text(bundle, "src/processes/upload-api.ts")).toContain('      "signIn": "required",');
    // The sign-in comes first, so the multipart setup can use it.
    const upload = text(bundle, "src/processes/upload-api.ts");
    expect(upload.indexOf("const creatorCheck = ")).toBeLessThan(
      upload.indexOf("const multipartUploads = "),
    );
    expect(upload).toContain("      guard: creatorCheck,");
    expect(upload).toContain("      lifecycle: lifecycle.uploadHooks,");
    // The upload's tile runs the lifecycle's upload hooks on the lifecycle worker's own binding.
    const config = (source: string) =>
      JSON.parse(source.slice(source.indexOf("= {") + 2, source.indexOf("} as const;") + 1));
    expect(config(upload).templates["multipart-uploads"].lifecycle).toEqual({
      selection: "lifecycle-writer",
      binding: config(text(bundle, "src/processes/video-lifecycle.ts")).templates[
        "lifecycle-writer"
      ].lifecycle,
    });
    // One realm for both guards: each guarded process verifies against Keycloak.
    const plan = json(bundle, "infra/local.json");
    expect(
      plan.identity.map((item: { id: string; roles: string[] }) => [item.id, item.roles]),
    ).toEqual([["sign-in", []]]);
    const services = json(bundle, "compose.yaml").services;
    for (const service of ["app-watch-api", "app-upload-api"]) {
      expect(services[service].depends_on["identity-sign-in"]).toEqual({
        condition: "service_healthy",
      });
      expect(services[service].environment).toMatchObject({
        OIDC_ISSUER: `http://127.0.0.1:\${LOCAL_IDENTITY_PORT:?Set LOCAL_IDENTITY_PORT}/realms/sign-in`,
        OIDC_JWKS_URL: "http://identity-sign-in:8080/realms/sign-in/protocol/openid-connect/certs",
      });
    }
    expect(services["app-video-lifecycle"].environment?.OIDC_ISSUER).toBeUndefined();
    expect(
      bundle.manifest.files.find((file) => file.path === "src/runtime/tile-guard.ts"),
    ).toMatchObject({ ownership: "generated-scaffold" });
    expect(stack.files.map((file) => file.path)).not.toContain("src/runtime/tile-guard.ts");
    // An Optional guard alone binds the Identity: Keycloak still runs for it.
    const watchOnly = runStudioCommands(emptyDesign(), [
      ...signInStackCommands.slice(0, 5),
      {
        type: "addModule",
        host: "watch-api",
        kind: "auth-guard",
        id: "viewer-check",
        name: "Viewer check",
      },
      {
        type: "connectModule",
        module: "viewer-check",
        slot: "identity",
        target: { tile: "sign-in" },
      },
    ]);
    const optional = assemble(
      runStudioCommands(watchOnly, [signIn(watchOnly, "viewer-check", "optional"), on]),
    );
    expect(optional.report.findings).toEqual([]);
    expect(Object.keys(json(optional, "compose.yaml").services)).toContain("identity-sign-in");
    // Without an asset lifecycle, multipart's own reserve, complete and closed stay to write.
    const alone = assemble(
      runStudioCommands(emptyDesign(), [
        ...signInStackCommands.filter(
          (command) =>
            !(
              "module" in command &&
              ["processing-consumer", "lifecycle-writer"].includes(String(command.module))
            ) && !(command.type === "addModule" && command.host === "video-lifecycle"),
        ),
        on,
      ]),
    );
    const hooks = text(alone, "src/modules/upload-api/multipart-uploads.hooks.ts");
    for (const hook of ["reserve", "complete", "closed"])
      expect(hooks).toContain(`throw new NotImplemented("${hook} for Multipart uploads");`);
    expect(hooks).not.toContain("lifecycle");
    expect(rows(alone).tiles.find((row) => row.tile === "upload-api")?.hooks[0]?.hooks).toEqual([
      "validate",
      "metadata",
      "response",
      "reserve",
      "complete",
      "closed",
      "originalKey",
      "job",
    ]);
  });

  it("gives route stubs the request signature with the option on, and changes nothing else", () => {
    const changed = stack.files
      .filter((file) => file.path.startsWith("src/modules/") && !file.path.endsWith(".hooks.ts"))
      .filter((file) => {
        const before = stackOff.files.find((item) => item.path === file.path);
        return !before || Buffer.compare(Buffer.from(before.bytes), Buffer.from(file.bytes)) !== 0;
      })
      .map((file) => file.path);
    // Route and loop stubs (loop-wiring.test.ts); library stubs, other scaffolds and
    // dependencies.ts keep their bytes.
    expect(changed).toEqual([
      "src/modules/entry.ts",
      "src/modules/links-api/limiter.ts",
      "src/modules/links-api/link-cache.ts",
      "src/modules/links-api/link-reader.ts",
      "src/modules/links-api/redirector.ts",
      "src/modules/links-api/stats-caller.ts",
      "src/modules/links-api/upload-consumer.slots.ts",
      "src/modules/links-api/upload-consumer.ts",
      "src/modules/links-api/visit-publisher.ts",
      "src/modules/stats-api/stats-search.ts",
      "src/modules/upload-api/archive-upload.ts",
      "src/modules/upload-api/upload-publisher.ts",
      "src/modules/visit-worker/visit-consumer.slots.ts",
      "src/modules/visit-worker/visit-consumer.ts",
    ]);
    expect(text(stack, "src/modules/links-api/redirector.ts")).toBe(
      [
        "// Redirector, a Redirect responder in Links API: Answers with an HTTP redirect and edge cache headers.",
        "// Write the module here. Export never overwrites your edits: export afresh and carry them over.",
        'import type { ModuleRequest, ModuleResponse } from "../entry.ts";',
        'import type { Dependencies } from "./redirector.slots.ts";',
        "",
        "/** Answers any method on /modules/redirector and every path below it. */",
        "export async function redirector(dependencies: Dependencies, request: ModuleRequest): Promise<ModuleResponse> {",
        '  throw new Error("Not implemented: Redirector");',
        "}",
        "",
      ].join("\n"),
    );
    expect(text(stackOff, "src/modules/links-api/redirector.ts")).toContain(
      "export async function redirector(dependencies: Dependencies): Promise<void> {",
    );
    expect(text(stack, "src/modules/entry.ts")).toContain("export type ModuleRequest = {");
    expect(stackOff.files.map((file) => file.path)).not.toContain("src/modules/entry.ts");
    // A stub-only stack off has the same files as the stub stack alone.
    expect(assemble(stubStackDesign()).files.length).toBe(52);
  });
});

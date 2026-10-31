import { posix } from "node:path";
import { fileURLToPath } from "node:url";
import type {
  ComposeService,
  GenerateContext,
  GenerateResult,
  ResolvedConnection,
} from "@jeeves/template-kit";
import {
  clientExportName,
  clientModulePath,
  contractPath,
  renderScaffold,
  restClientTargets,
} from "@jeeves/template-kit";

export { contractPath };

const SCAFFOLD = fileURLToPath(new URL("./scaffold/service", import.meta.url));

/** How long a graceful shutdown may take inside the container (`SHUTDOWN_TIMEOUT_MS`). */
export const SHUTDOWN_TIMEOUT_MS = 10_000;

/** The compose health check: the service is healthy when `/ready` answers 200. */
export function healthcheck(port: number): ComposeService["healthcheck"] {
  const probe = `fetch("http://127.0.0.1:${port}/ready").then((r) => process.exit(r.ok ? 0 : 1), () => process.exit(1))`;
  return {
    test: ["CMD", "node", "-e", probe],
    interval: "2s",
    timeout: "3s",
    retries: 15,
    start_period: "60s",
  };
}

interface Wiring {
  database?: { id: string; name: string };
  restServer?: { basePath: string; auth: string };
  /** REST clients (rest-api-client attachments), by target element ID. */
  clients: { target: string; exportName: string; module: string }[];
}

/** What the design says this service is wired to. Throws on wiring this version can't build. */
export function wiringOf(ctx: GenerateContext): Wiring {
  const wiring: Wiring = {
    clients: restClientTargets(ctx).map(({ target }) => ({
      target: target.id,
      exportName: clientExportName(target.id),
      module: `./${posix.relative(`${ctx.dir}/src`, clientModulePath(ctx.dir, target.id))}`,
    })),
  };
  const databases = ctx.outgoing.filter((c) => c.connection.kind === "uses-database");
  if (databases.length > 1) {
    throw new Error(`${ctx.element.id} uses ${databases.length} databases; one is supported`);
  }
  const [database] = databases;
  if (database) wiring.database = databaseOf(ctx, database);
  const server = ctx.attachments.find((a) => a.manifest.id === "rest-api-server");
  if (server) {
    wiring.restServer = {
      basePath: String(server.config.basePath),
      auth: String(server.config.auth),
    };
  }
  return wiring;
}

function databaseOf(ctx: GenerateContext, { peer }: ResolvedConnection) {
  if (peer.manifest?.id !== "postgres") {
    const what = peer.manifest ? `template ${peer.manifest.id}` : "an element with no template";
    throw new Error(`${ctx.element.id} can't use ${what} as a database yet`);
  }
  return { id: peer.element.id, name: peer.element.name };
}

/** `src/jeeves.generated.ts`: the service definition, from its attachments and connections. */
export function wiringSource(ctx: GenerateContext): string {
  const { element, config } = ctx;
  const wiring = wiringOf(ctx);
  const q = (value: unknown) => JSON.stringify(value);
  // Names come from the design; keep them from closing a comment early.
  const c = (text: string) => text.replaceAll("*/", "* /");
  const resourceModel = ctx.attachments.find((a) => a.manifest.id === "rest-api-server")?.config
    .model;
  const delivery = ctx.attachments.some((a) => a.manifest.id === "durable-events");
  if (delivery && !wiring.database) throw new Error("Durable events require a Postgres connection");
  const imports = [
    'import { fileURLToPath } from "node:url";',
    wiring.database && 'import { postgresDependency } from "@jeeves/postgres-runtime";',
    wiring.restServer && !resourceModel && 'import { restServer } from "@jeeves/rest-server";',
    'import { defineService } from "@jeeves/service-runtime";',
    ...wiring.clients.map((c) => `import { ${c.exportName} } from ${q(c.module)};`),
    resourceModel && 'import { generatedApi } from "./generated/routes.ts";',
    delivery && 'import { createDeliveryBinding } from "./delivery/adapter.ts";',
    wiring.database && 'import * as schema from "./db/schema.ts";',
  ].filter(Boolean);

  const body: string[] = [
    "const path = (relative: string) => fileURLToPath(new URL(relative, import.meta.url));",
  ];
  const dependencies: string[] = [];
  if (wiring.database) {
    body.push(
      "",
      `/** The ${c(q(wiring.database.name))} postgres element (uses-database). Query it with \`database.db\`. */`,
      "export const database = postgresDependency({",
      `  name: ${q(wiring.database.id)},`,
      "  schema,",
      '  migrationsFolder: path("../migrations"),',
      ...(resourceModel ? ['  resourceMigrationsFolder: path("../resource-migrations"),'] : []),
      "});",
    );
    dependencies.push("database");
  }
  const plugins: string[] = [];
  if (delivery) {
    body.push("", "export const delivery = createDeliveryBinding(() => database.pool);");
    dependencies.push("delivery.dependency");
    plugins.push("delivery.plugin,");
  }
  if (wiring.restServer) {
    const contract = posix.relative(`${ctx.dir}/src`, contractPath(element.id));
    if (resourceModel) plugins.push(`generatedApi(() => database.pool, path(${q(contract)})),`);
    else
      plugins.push(
        [
          "restServer({",
          `      contract: path(${q(contract)}),`,
          `      basePath: ${q(wiring.restServer.basePath)},`,
          `      auth: ${q(wiring.restServer.auth)},`,
          "    }),",
        ].join("\n"),
      );
  }
  for (const client of wiring.clients) {
    // The plugin checks the client's environment at startup and forwards request IDs.
    plugins.push(`${client.exportName}.plugin,`);
  }
  body.push(
    "",
    `/** ${c(element.name)} (${element.id}), as the design describes it. */`,
    "export const service = defineService({",
    `  name: ${q(element.id)},`,
    `  displayName: ${q(element.name)},`,
    `  defaults: { port: ${Number(config.port)}, logLevel: ${q(config.logLevel)} },`,
    `  dependencies: [${dependencies.join(", ")}],`,
    plugins.length > 0 ? `  plugins: [\n    ${plugins.join("\n    ")}\n  ],` : "  plugins: [],",
    "});",
  );

  return [
    "// Generated by Jeeves from the design. Do not edit: it's rewritten on every generation.",
    "// To change the wiring, change the design (attachments, connections, config) and regenerate.",
    ...imports,
    "",
    ...body,
    "",
  ].join("\n");
}

export function generate(ctx: GenerateContext): GenerateResult {
  const { element, config, dir } = ctx;
  const port = Number(config.port);
  const files = renderScaffold(SCAFFOLD, dir, {
    serviceId: element.id,
    serviceName: element.name,
    serviceDir: dir,
  });
  files.push({
    path: `${dir}/src/jeeves.generated.ts`,
    contents: wiringSource(ctx),
    ownership: "generated",
  });

  const dependsOn: NonNullable<ComposeService["depends_on"]> = {};
  for (const { connection, peer } of ctx.outgoing) {
    if (connection.kind !== "depends-on" || peer.dir === undefined) continue;
    dependsOn[peer.element.id] = {
      condition: peer.manifest?.id === "http-service" ? "service_healthy" : "service_started",
    };
  }

  const service: ComposeService = {
    build: { context: ".", dockerfile: `${dir}/Dockerfile` },
    environment: {
      PORT: String(port),
      LOG_LEVEL: String(config.logLevel),
      SHUTDOWN_TIMEOUT_MS: String(SHUTDOWN_TIMEOUT_MS),
    },
    // An ephemeral host port on loopback: reachable for tests and tools, never from the network.
    ports: [`127.0.0.1::${port}`],
    healthcheck: healthcheck(port),
    restart: "unless-stopped",
    stop_grace_period: `${SHUTDOWN_TIMEOUT_MS / 1000 + 5}s`,
    ...(Object.keys(dependsOn).length > 0 && { depends_on: dependsOn }),
  };

  return {
    files,
    compose: { services: { [element.id]: service } },
    runtimeDependencies: [{ element: element.id, name: "@jeeves/service-runtime" }],
  };
}

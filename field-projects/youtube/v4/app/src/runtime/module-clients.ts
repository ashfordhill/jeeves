// Generated scaffold: real clients behind the module stubs' interfaces (src/modules/dependencies.ts),
// one per store or channel a tile's stubs use. Export rewrites this file. Each client runs one
// bounded startup probe that its access allows; a failed probe fails the process's startup.
import { localLogins } from "../features/local-bindings.ts";
import { createPostgres } from "./postgres.ts";
import { randomUUID } from "node:crypto";
import { createPublisher, type BrokerState } from "./amqp.ts";
import type {
  CacheClient,
  DatabaseReadWriter,
  HttpTarget,
  ObjectStore,
  QueuePublisher,
  SearchIndex,
} from "../modules/dependencies.ts";
import type { ProcessScope } from "./process.ts";
import { NotImplemented } from "./tile-process.ts";

/** A dependency that isn't provisioned locally (another provider, an Identity, a CDN, an external
 * API): calling it, or any of its members, answers "Not implemented: <what>". */
export function unavailable<T extends object>(what: string): T {
  const fail = () => Promise.reject(new NotImplemented(what));
  return new Proxy(fail, {
    get: (_target, property) =>
      typeof property === "string" && property !== "then" ? fail : undefined,
  }) as unknown as T;
}

export type ProbeLog = (entry: Record<string, unknown>) => void;
/** One JSON line per client probe: `ok` once it passes, or the error before startup fails. */
export function createProbeLog(tile: string): ProbeLog {
  return (entry) => console.log(JSON.stringify({ event: "probe", tile, ...entry }));
}
const describe = (error: unknown) =>
  (error instanceof Error ? `${error.name}: ${error.message}` : String(error)).slice(0, 300);
/** Runs one bounded startup check (5 s); a failure is logged and fails startup. */
async function probed(
  log: ProbeLog,
  client: { client: string; kind: string; check: string },
  check: () => Promise<unknown>,
) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      check(),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error("Probe deadline (5 s)")), 5000);
      }),
    ]);
  } catch (error) {
    log({ level: "error", ...client, result: "failed", error: describe(error) });
    throw new Error(`Startup probe failed: ${client.kind} ${client.client}`);
  } finally {
    clearTimeout(timer);
  }
  log({ level: "info", ...client, result: "ok" });
}

/** A database through the tile's own runtime login: CONNECT and USAGE on public, and SELECT on
 * what another owner publishes when the tile may only read it. Stubs own no tables: a module's
 * own tables need a migration and grants of their own. Probe: SELECT 1. */
export async function databaseClient(
  scope: ProcessScope,
  log: ProbeLog,
  binding: { tile: string; resource: string },
): Promise<DatabaseReadWriter> {
  const login = localLogins.find(
    (item) => item.resource === binding.resource && item.host === binding.tile,
  );
  if (!login) throw new Error(`No runtime login for ${binding.resource}`);
  const pool = createPostgres({
    hostname: "local-postgres",
    port: 5432,
    login,
    poolSize: 10,
    statementTimeoutMs: 2000,
    connectionTimeoutMs: 2000,
  });
  // An idle connection's error is not fatal: the next query reconnects.
  pool.on("error", () => {});
  scope.own(() => pool.end());
  await probed(log, { client: binding.resource, kind: "database", check: "SELECT 1" }, () =>
    pool.query("SELECT 1"),
  );
  const run = (sql: string, values?: readonly unknown[]) =>
    pool.query(sql, values ? [...values] : undefined);
  return {
    async query<Row = Record<string, unknown>>(sql: string, values?: readonly unknown[]) {
      return (await run(sql, values)).rows as Row[];
    },
    async execute(sql, values) {
      return { rowCount: (await run(sql, values)).rowCount ?? 0 };
    },
  };
}
const broker = {
  hostname: "local-broker",
  port: 5672,
  username: "runtime",
  passwordSecret: "broker-password",
  heartbeatSeconds: 10,
  confirmTimeoutMs: 5000,
};
/** A work queue or topic a module publishes to, with publisher confirms; each message gets the
 * module's `messageId`, or else a fresh ID, and `key` is not used locally. After a lost broker
 * connection it reconnects every 5 s, telling `onState`, as a loop's consumer does; a publish
 * while the broker is away fails at once. Probe: opening the broker and a confirm channel. */
export async function queuePublisher(
  scope: ProcessScope,
  log: ProbeLog,
  binding: { queue: string; mode: "work-queue" | "topic" },
  onState?: BrokerState,
): Promise<QueuePublisher> {
  const topic = binding.mode === "topic";
  let publisher: Awaited<ReturnType<typeof createPublisher>> | undefined;
  await probed(
    log,
    { client: binding.queue, kind: "queue", check: "open the broker and a confirm channel" },
    async () => {
      publisher = await createPublisher(
        broker,
        { exchange: topic ? binding.queue : "", routingKey: topic ? "" : binding.queue },
        { onState },
      );
    },
  );
  const opened = publisher;
  if (!opened) throw new Error(`No publisher for ${binding.queue}`);
  scope.own(() => opened.close());
  scope.transport(opened);
  return { publish: (message, options) => opened.publish(message, options?.messageId ?? randomUUID()) };
}

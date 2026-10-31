import { randomUUID } from "node:crypto";
import { canonicalPayload } from "./json.ts";
import {
  type DeliveryPolicy,
  type DeliveryPreset,
  deliveryPolicy,
  parsePolicy,
  retryDelay,
} from "./policy.ts";

export interface QueryResult {
  rows: Record<string, unknown>[];
  rowCount?: number | null;
}
export interface Sql {
  query(sql: string, values?: unknown[]): Promise<QueryResult>;
}
export interface SqlConnection extends Sql {
  release(destroy?: boolean): void;
}
export interface DeliveryDatabase {
  connect(): Promise<SqlConnection>;
}
export interface EventDefinition<T = unknown> {
  readonly type: string;
  readonly version: number;
  readonly parse: (value: unknown) => T;
}
const eventKey = (event: { type: string; version: number }) => `${event.type}@${event.version}`;
const scope = (value: string, name: string, max: number) => {
  if (
    typeof value !== "string" ||
    !value.length ||
    value.length > max ||
    [...value].some((char) => char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127) ||
    /[\uD800-\uDFFF]/u.test(value)
  )
    throw new Error(`Invalid delivery ${name}`);
  return value;
};
const uuid = (value: string) => {
  if (!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(value))
    throw new Error("Invalid delivery ID");
  return value;
};
export function defineEvent<T>(definition: EventDefinition<T>): EventDefinition<T> {
  if (
    !/^[a-z][a-z0-9.-]{0,119}$/.test(definition.type) ||
    !Number.isInteger(definition.version) ||
    definition.version < 1 ||
    definition.version > 1000 ||
    typeof definition.parse !== "function"
  )
    throw new Error("Invalid event definition");
  return Object.freeze({ ...definition });
}
export type DeliveryState = "pending" | "running" | "succeeded" | "exhausted";
export type DeliveryErrorCode =
  | "handler-failed"
  | "invalid-payload"
  | "unsupported-event"
  | "deadline-exceeded"
  | "cancelled"
  | "lease-expired"
  | "permanent-failure";
export interface DeliveryStatus {
  id: string;
  type: string;
  version: number;
  state: DeliveryState;
  attempts: number;
  availableAt: string;
  createdAt: string;
  completedAt: string | null;
  lastError: DeliveryErrorCode | null;
  /** A database effect may be committed even if later handler work failed. */
  effectCommitted: boolean;
}
export interface DeliveryLease extends DeliveryStatus {
  tenantId: string;
  payload: unknown;
  token: string;
  leaseUntil: string;
  policy: DeliveryPolicy;
}
export type DeliveryClaim =
  | { kind: "claimed"; delivery: DeliveryLease }
  | { kind: "exhausted"; delivery: DeliveryStatus }
  | null;
export interface ProducerTransaction extends Sql {
  /** Caller establishes tenant scope; a body cannot override it on an individual event. */
  emit<T>(
    event: EventDefinition<T>,
    key: string,
    payload: unknown,
  ): Promise<{ id: string; created: boolean }>;
}
export class DeliveryConflict extends Error {
  constructor() {
    super("Delivery key already identifies a different event");
  }
}
export class DeliveryLeaseLost extends Error {
  constructor() {
    super("Delivery lease is no longer current");
  }
}

const table = "public.jeeves_event_delivery_v1";
const receipts = "public.jeeves_event_receipt_v1";
const columns =
  "id, event_type, event_version, state, attempts, available_at, created_at, completed_at, last_error, EXISTS (SELECT 1 FROM public.jeeves_event_receipt_v1 WHERE delivery_id=jeeves_event_delivery_v1.id) AS effect_committed";
const date = (value: unknown) => {
  const parsed = value instanceof Date ? value : new Date(String(value));
  if (!Number.isFinite(parsed.valueOf())) throw new Error("Invalid persisted delivery timestamp");
  return parsed.toISOString();
};
function status(row: Record<string, unknown>): DeliveryStatus {
  if (
    !["pending", "running", "succeeded", "exhausted"].includes(String(row.state)) ||
    !Number.isInteger(row.attempts) ||
    Number(row.attempts) < 0 ||
    Number(row.attempts) > 10
  )
    throw new Error("Invalid persisted delivery state");
  return {
    id: uuid(String(row.id)),
    type: String(row.event_type),
    version: Number(row.event_version),
    state: row.state as DeliveryState,
    attempts: Number(row.attempts),
    availableAt: date(row.available_at),
    createdAt: date(row.created_at),
    completedAt: row.completed_at === null ? null : date(row.completed_at),
    lastError: row.last_error as DeliveryErrorCode | null,
    effectCommitted: row.effect_committed === true,
  };
}

/** Explicit transaction ownership; connections never escape with a live callback scope. */
async function transaction<T>(
  database: DeliveryDatabase,
  work: (tx: Sql) => Promise<T>,
): Promise<T> {
  const connection = await database.connect();
  let active = true,
    destroy = false;
  const queries: Promise<QueryResult>[] = [];
  const tx: Sql = {
    query(sql, values) {
      if (!active) return Promise.reject(new Error("Delivery transaction is closed"));
      // Callbacks issue parameterized business DML, not transaction control or multiple statements.
      const promise =
        !/^\s*(SELECT|INSERT|UPDATE|DELETE|WITH)\b/i.test(sql) || sql.includes(";")
          ? Promise.reject(
              new Error(
                "Delivery callbacks require one DML statement; the component owns transaction control",
              ),
            )
          : connection.query(sql, values);
      // Retain failed fire-and-forget queries as transaction failures, never a successful commit.
      void promise.catch(() => {});
      queries.push(promise);
      return promise;
    },
  };
  try {
    await connection.query("BEGIN");
    await connection.query("SET LOCAL statement_timeout = '5s'");
    await connection.query("SET LOCAL lock_timeout = '2s'");
    await connection.query("SET LOCAL idle_in_transaction_session_timeout = '15s'");
    const result = await work(tx);
    active = false;
    const settled = await Promise.allSettled(queries);
    const failed = settled.find((item) => item.status === "rejected");
    if (failed?.status === "rejected") throw failed.reason;
    await connection.query("COMMIT");
    return result;
  } catch (error) {
    active = false;
    try {
      await connection.query("ROLLBACK");
    } catch {
      destroy = true;
    }
    throw error;
  } finally {
    active = false;
    connection.release(destroy);
  }
}

export class Outbox {
  readonly queue: string;
  readonly policy: DeliveryPolicy;
  private readonly events = new Map<string, EventDefinition>();
  constructor(
    private readonly database: DeliveryDatabase,
    options: { queue: string; events: readonly EventDefinition[]; preset?: DeliveryPreset },
  ) {
    if (!/^[a-z][a-z0-9-]{0,62}$/.test(options.queue)) throw new Error("Invalid delivery queue");
    if (!options.events.length || options.events.length > 100)
      throw new Error("Register between one and 100 event definitions");
    this.queue = options.queue;
    this.policy = Object.freeze(deliveryPolicy(options.preset));
    for (const event of options.events) {
      defineEvent(event);
      if (this.events.has(eventKey(event))) throw new Error("Duplicate event definition");
      this.events.set(eventKey(event), Object.freeze(event));
    }
  }
  definitions(): readonly EventDefinition[] {
    return [...this.events.values()];
  }
  definition(type: string, version: number): EventDefinition | undefined {
    return this.events.get(eventKey({ type, version }));
  }

  async transaction<T>(
    tenantId: string,
    work: (tx: ProducerTransaction) => Promise<T>,
  ): Promise<T> {
    scope(tenantId, "tenant", 128);
    return transaction(this.database, async (sql) => {
      const pending: Promise<unknown>[] = [];
      const tx: ProducerTransaction = {
        query: sql.query,
        emit: (event, key, payload) => {
          const promise = this.enqueue(sql, tenantId, event, key, payload);
          void promise.catch(() => {});
          pending.push(promise);
          return promise;
        },
      };
      const result = await work(tx);
      // An enqueue forgotten by the caller still must finish or fail before business commit.
      const settled = await Promise.allSettled(pending);
      const failure = settled.find((item) => item.status === "rejected");
      if (failure?.status === "rejected") throw failure.reason;
      return result;
    });
  }
  private async enqueue<T>(
    tx: Sql,
    tenantId: string,
    event: EventDefinition<T>,
    key: string,
    payload: unknown,
  ) {
    if (this.definition(event.type, event.version) !== event)
      throw new Error("Event is not registered with this outbox");
    scope(key, "deduplication key", 160);
    const normalized = canonicalPayload(event.parse(payload));
    const id = randomUUID();
    const inserted = await tx.query(
      `INSERT INTO ${table} (id,queue,tenant_id,deduplication_key,event_type,event_version,payload,payload_hash,policy)
      VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8,$9::jsonb)
      ON CONFLICT (queue,tenant_id,deduplication_key) DO NOTHING RETURNING id`,
      [
        id,
        this.queue,
        tenantId,
        key,
        event.type,
        event.version,
        normalized.json,
        normalized.hash,
        JSON.stringify(this.policy),
      ],
    );
    if (inserted.rows.length) return { id, created: true };
    const existing = (
      await tx.query(
        `SELECT id,event_type,event_version,payload_hash FROM ${table} WHERE queue=$1 AND tenant_id=$2 AND deduplication_key=$3`,
        [this.queue, tenantId, key],
      )
    ).rows[0];
    if (
      !existing ||
      existing.event_type !== event.type ||
      existing.event_version !== event.version ||
      existing.payload_hash !== normalized.hash
    )
      throw new DeliveryConflict();
    return { id: String(existing.id), created: false };
  }

  async claim(): Promise<DeliveryClaim> {
    return transaction(this.database, async (tx) => {
      const token = randomUUID();
      const row = (
        await tx.query(
          `WITH candidate AS (
        SELECT id FROM ${table} WHERE queue=$1 AND
          ((state='pending' AND available_at<=clock_timestamp()) OR (state='running' AND lease_until<=clock_timestamp()))
        ORDER BY available_at,id FOR UPDATE SKIP LOCKED LIMIT 1
      ) UPDATE ${table} AS event SET
        state=CASE WHEN attempts >= (policy->>'maxAttempts')::int THEN 'exhausted' ELSE 'running' END,
        attempts=CASE WHEN attempts >= (policy->>'maxAttempts')::int THEN attempts ELSE attempts+1 END,
        lease_token=CASE WHEN attempts >= (policy->>'maxAttempts')::int THEN NULL ELSE $2::uuid END,
        lease_until=CASE WHEN attempts >= (policy->>'maxAttempts')::int THEN NULL ELSE clock_timestamp()+((policy->>'leaseMs')::int * interval '1 millisecond') END,
        completed_at=CASE WHEN attempts >= (policy->>'maxAttempts')::int THEN clock_timestamp() ELSE NULL END,
        last_error=CASE WHEN state='running' THEN 'lease-expired' ELSE last_error END,
        updated_at=clock_timestamp()
      FROM candidate WHERE event.id=candidate.id RETURNING event.*, EXISTS (SELECT 1 FROM ${receipts} WHERE delivery_id=event.id) AS effect_committed`,
          [this.queue, token],
        )
      ).rows[0];
      if (!row) return null;
      const current = status(row);
      if (current.state === "exhausted") return { kind: "exhausted", delivery: current };
      return {
        kind: "claimed",
        delivery: {
          ...current,
          tenantId: String(row.tenant_id),
          payload: row.payload,
          token,
          leaseUntil: date(row.lease_until),
          policy: parsePolicy(row.policy),
        },
      };
    });
  }
  async acknowledge(delivery: DeliveryLease): Promise<boolean> {
    return transaction(
      this.database,
      async (tx) =>
        (
          await tx.query(
            `UPDATE ${table} SET state='succeeded',completed_at=clock_timestamp(),updated_at=clock_timestamp(),lease_token=NULL,lease_until=NULL,last_error=NULL
      WHERE queue=$1 AND id=$2 AND tenant_id=$3 AND state='running' AND lease_token=$4 AND lease_until>clock_timestamp() RETURNING id`,
            [this.queue, uuid(delivery.id), delivery.tenantId, uuid(delivery.token)],
          )
        ).rows.length === 1,
    );
  }
  async fail(
    delivery: DeliveryLease,
    code: DeliveryErrorCode,
    permanent = false,
  ): Promise<boolean> {
    const delay = retryDelay(delivery.policy, delivery.id, delivery.attempts);
    return transaction(
      this.database,
      async (tx) =>
        (
          await tx.query(
            `UPDATE ${table} SET
      state=CASE WHEN $6 OR attempts >= (policy->>'maxAttempts')::int THEN 'exhausted' ELSE 'pending' END,
      completed_at=CASE WHEN $6 OR attempts >= (policy->>'maxAttempts')::int THEN clock_timestamp() ELSE NULL END,
      available_at=clock_timestamp()+($7 * interval '1 millisecond'), updated_at=clock_timestamp(),
      lease_token=NULL,lease_until=NULL,last_error=$5
      WHERE queue=$1 AND id=$2 AND tenant_id=$3 AND state='running' AND lease_token=$4 AND lease_until>clock_timestamp() RETURNING id`,
            [
              this.queue,
              uuid(delivery.id),
              delivery.tenantId,
              uuid(delivery.token),
              code,
              permanent,
              delay,
            ],
          )
        ).rows.length === 1,
    );
  }

  /** Receipt and database-only business effect commit together. No external side effects here. */
  async effect(delivery: DeliveryLease, work: (tx: Sql) => Promise<void>): Promise<boolean> {
    return transaction(this.database, async (tx) => {
      const owned = await tx.query(
        `SELECT id FROM ${table} WHERE queue=$1 AND id=$2 AND tenant_id=$3 AND state='running' AND lease_token=$4 AND lease_until>clock_timestamp() FOR UPDATE`,
        [this.queue, uuid(delivery.id), delivery.tenantId, uuid(delivery.token)],
      );
      if (!owned.rows.length) throw new DeliveryLeaseLost();
      const receipt = await tx.query(
        `INSERT INTO ${receipts} (delivery_id) VALUES ($1) ON CONFLICT DO NOTHING RETURNING delivery_id`,
        [delivery.id],
      );
      if (!receipt.rows.length) return false;
      await work(tx);
      const live = await tx.query(
        `SELECT id FROM ${table} WHERE id=$1 AND lease_token=$2 AND lease_until>clock_timestamp()`,
        [delivery.id, delivery.token],
      );
      if (!live.rows.length) throw new DeliveryLeaseLost();
      return true;
    });
  }
  async status(tenantId: string, id: string): Promise<DeliveryStatus | undefined> {
    scope(tenantId, "tenant", 128);
    uuid(id);
    return transaction(this.database, async (tx) => {
      const row = (
        await tx.query(
          `SELECT ${columns} FROM ${table} WHERE queue=$1 AND tenant_id=$2 AND id=$3`,
          [this.queue, tenantId, id],
        )
      ).rows[0];
      return row ? status(row) : undefined;
    });
  }
  async list(
    tenantId: string,
    options: { state?: DeliveryState; limit?: number } = {},
  ): Promise<DeliveryStatus[]> {
    scope(tenantId, "tenant", 128);
    const limit = options.limit ?? 25;
    if (
      !Number.isInteger(limit) ||
      limit < 1 ||
      limit > 100 ||
      (options.state !== undefined &&
        !["pending", "running", "succeeded", "exhausted"].includes(options.state))
    )
      throw new Error("Invalid delivery status selection");
    return transaction(this.database, async (tx) =>
      (
        await tx.query(
          `SELECT ${columns} FROM ${table} WHERE queue=$1 AND tenant_id=$2 AND ($3::text IS NULL OR state=$3) ORDER BY created_at DESC,id LIMIT $4`,
          [this.queue, tenantId, options.state ?? null, limit],
        )
      ).rows.map(status),
    );
  }
}

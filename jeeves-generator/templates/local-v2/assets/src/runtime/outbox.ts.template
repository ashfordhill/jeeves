import type { createPublisher } from "./amqp.ts";
import {
  durableIdentity,
  jsonPayload,
  qualifiedRelation,
  validateOutboxTable,
  type OutboxTable,
} from "./durable-sql.ts";
import {
  abortTransaction,
  assertTransaction,
  transaction,
  type TransactionPool,
  type Tx,
} from "./transaction.ts";

// Reuse the actual YV2-05 confirmed publisher contract, without another transport wrapper.
export type ConfirmedPublisher = Pick<Awaited<ReturnType<typeof createPublisher>>, "publish">;
export type PayloadCodec<T> = (input: unknown, eventId: string) => T;
export function createOutbox<Payload>(
  binding: OutboxTable,
  destination: string,
  parse: PayloadCodec<Payload>,
) {
  validateOutboxTable(binding);
  if (!binding.destinations.includes(destination)) throw new Error("Unbound outbox destination");
  const table = qualifiedRelation(binding);
  return {
    async enqueue(
      tx: Tx,
      intent: { eventId: string; intentKey: string; payload: unknown },
    ): Promise<boolean> {
      assertTransaction(tx);
      try {
        const eventId = durableIdentity(intent.eventId),
          intentKey = durableIdentity(intent.intentKey);
        const payload = jsonPayload(parse(intent.payload, eventId));
        const inserted = await tx.query(
          `INSERT INTO ${table}(event_id,destination,intent_key,payload) VALUES($1,$2,$3,$4::jsonb) ON CONFLICT DO NOTHING RETURNING event_id`,
          [eventId, destination, intentKey, payload],
        );
        if (inserted.rowCount) return true;
        const existing = await tx.query(
          `SELECT event_id FROM ${table} WHERE event_id=$1 AND destination=$2 AND intent_key=$3 AND payload=$4::jsonb`,
          [eventId, destination, intentKey, payload],
        );
        if (!existing.rowCount) throw new Error("Conflicting durable intent identity or payload");
        return false;
      } catch (error) {
        return abortTransaction(tx, error);
      }
    },
    async relayBatch(pool: TransactionPool, publisher: ConfirmedPublisher, limit = 10) {
      if (!Number.isInteger(limit) || limit < 1 || limit > 25)
        throw new Error("Invalid outbox batch");
      // Row locks span the bounded batch and publisher's bounded confirms. Broker I/O is
      // NOT atomic with SQL: a crash/SQL failure after confirm can repeat the same event ID.
      return transaction(pool, async (tx) => {
        const rows = await tx.query<{
          event_id: string;
          payload: unknown;
          attempts: number;
        }>(
          `SELECT event_id,payload,attempts FROM ${table} WHERE destination=$1 AND sent_at IS NULL AND next_attempt_at<=clock_timestamp() ORDER BY created_at,event_id LIMIT $2 FOR UPDATE SKIP LOCKED`,
          [destination, limit],
        );
        let sent = 0,
          deferred = 0;
        for (const row of rows.rows) {
          try {
            await publisher.publish(
              Buffer.from(jsonPayload(parse(row.payload, durableIdentity(row.event_id)))),
              row.event_id,
            );
          } catch {
            const delay = Math.min(5000, 250 * 2 ** Math.min(row.attempts, 5));
            await tx.query(
              `UPDATE ${table} SET attempts=LEAST(attempts,2147483646)+1,next_attempt_at=clock_timestamp()+$2::int*interval '1 millisecond' WHERE event_id=$1`,
              [row.event_id, delay],
            );
            deferred++;
            continue;
          }
          // SQL failure must roll back the batch; it must never masquerade as publish failure.
          await tx.query(
            `UPDATE ${table} SET sent_at=clock_timestamp(),attempts=LEAST(attempts,2147483646)+1 WHERE event_id=$1`,
            [row.event_id],
          );
          sent++;
        }
        return { selected: rows.rowCount ?? 0, sent, deferred };
      });
    },
  };
}
export function startRelay<Payload>(
  outbox: ReturnType<typeof createOutbox<Payload>>,
  pool: TransactionPool,
  publisher: ConfirmedPublisher,
  options: { limit?: number; onError?: (error: unknown) => void } = {},
) {
  const limit = options.limit ?? 10;
  if (!Number.isInteger(limit) || limit < 1 || limit > 25) throw new Error("Invalid outbox batch");
  let stopped = false,
    timer: ReturnType<typeof setTimeout> | undefined;
  let running: Promise<unknown> = Promise.resolve(),
    closing: Promise<void> | undefined;
  const tick = () => {
    running = outbox
      .relayBatch(pool, publisher, limit)
      .catch((error: unknown) => {
        try {
          options.onError?.(error);
        } catch {
          /* Notification must not prevent drain. */
        }
      })
      .finally(() => {
        if (!stopped) timer = setTimeout(tick, 1000);
      });
  };
  tick();
  return {
    close(): Promise<void> {
      if (closing) return closing;
      stopped = true;
      clearTimeout(timer);
      return (closing = running.then(() => {}));
    },
  };
}

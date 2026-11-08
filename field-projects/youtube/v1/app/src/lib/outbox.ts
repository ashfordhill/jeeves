import type pg from "pg";
import { parseMessage } from "../contracts/v1.ts";
import { transaction } from "../state/transaction.ts";
export type OutboxDestination = "upload-jobs" | "publication-events";
export interface ConfirmedPublisher {
  publish(body: Uint8Array, messageId: string): Promise<void>;
}
// Caller selects one destination and its dedicated publisher. Crash after confirm can duplicate eventId.
export async function relayBatch(
  pool: pg.Pool,
  destination: OutboxDestination,
  publisher: ConfirmedPublisher,
  limit = 10,
) {
  if (
    !["upload-jobs", "publication-events"].includes(destination) ||
    !Number.isInteger(limit) ||
    limit < 1 ||
    limit > 25
  )
    throw new Error("Invalid outbox batch");
  return transaction(pool, async (tx) => {
    const rows = await tx.query(
      `SELECT event_id,payload,attempts FROM video_private.outbox WHERE destination=$1 AND sent_at IS NULL AND next_attempt_at<=clock_timestamp() ORDER BY created_at,event_id LIMIT $2 FOR UPDATE SKIP LOCKED`,
      [destination, limit],
    );
    let sent = 0;
    for (const row of rows.rows) {
      try {
        const body = Buffer.from(JSON.stringify(row.payload));
        parseMessage(destination, body, row.event_id);
        await publisher.publish(body, row.event_id);
        await tx.query(
          `UPDATE video_private.outbox SET sent_at=clock_timestamp(),attempts=attempts+1 WHERE event_id=$1`,
          [row.event_id],
        );
        sent++;
      } catch {
        const delay = Math.min(5000, 250 * 2 ** Math.min(row.attempts, 5));
        await tx.query(
          `UPDATE video_private.outbox SET attempts=attempts+1,next_attempt_at=clock_timestamp()+$2::int*interval '1 millisecond' WHERE event_id=$1`,
          [row.event_id, delay],
        );
        console.error(`Outbox ${destination} delivery deferred`);
      }
    }
    return sent;
  });
}
export function startRelay(
  pool: pg.Pool,
  destination: OutboxDestination,
  publisher: ConfirmedPublisher,
) {
  let stopped = false,
    timer: ReturnType<typeof setTimeout> | undefined;
  let running: Promise<unknown> = Promise.resolve();
  const tick = () => {
    running = relayBatch(pool, destination, publisher)
      .catch(() => console.error(`Outbox ${destination} unavailable`))
      .finally(() => {
        if (!stopped) timer = setTimeout(tick, 1000);
      });
  };
  tick();
  return async () => {
    stopped = true;
    clearTimeout(timer);
    await running;
  };
}

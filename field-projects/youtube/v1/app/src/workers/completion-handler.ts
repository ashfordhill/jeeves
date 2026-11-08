import { rm, writeFile } from "node:fs/promises";
import { connect as consumer } from "../clients/handler-consumer.ts";
import { connect as publications } from "../clients/handler-publications.ts";
import { connect as state } from "../clients/handler-writer.ts";
import { parseMessage, processingEvent } from "../contracts/v1.ts";
import { NonRetryable } from "../lib/amqp.ts";
import { startRelay } from "../lib/outbox.ts";
import { applyProcessing, sweepJobs } from "../state/video.ts";
import { transaction } from "../state/transaction.ts";
const pool = state();
pool.on("error", () => console.error("Lifecycle database unavailable"));
let publisher: Awaited<ReturnType<typeof publications>> | undefined,
  input: Awaited<ReturnType<typeof consumer>> | undefined,
  stopRelay: (() => Promise<void>) | undefined;
let stopped = false,
  timer: ReturnType<typeof setTimeout> | undefined,
  sweeping: Promise<unknown> = Promise.resolve(),
  shutdown: Promise<void> | undefined;
function sweep() {
  sweeping = transaction(pool, sweepJobs)
    .catch(() => console.error("Lifecycle deadline sweep deferred"))
    .finally(() => {
      if (!stopped) timer = setTimeout(sweep, 30000);
    });
}
function close() {
  return (shutdown ??= (async () => {
    stopped = true;
    clearTimeout(timer);
    await rm("/tmp/shell-ready", { force: true });
    await input?.close();
    await sweeping;
    await stopRelay?.();
    await publisher?.close();
    await pool.end();
  })());
}
try {
  await rm("/tmp/shell-ready", { force: true });
  await pool.query("SELECT event_id FROM video_private.inbox LIMIT 0");
  // Apply overdue policy immediately, including jobs deliberately staged by FP06b.
  await transaction(pool, sweepJobs);
  publisher = await publications();
  stopRelay = startRelay(pool, "publication-events", publisher);
  sweep();
  input = await consumer(async (body, delivery) => {
    let event;
    try {
      if (!delivery.messageId) throw new Error("Missing identity");
      event = processingEvent.parse(parseMessage("processing-events", body, delivery.messageId));
    } catch {
      throw new NonRetryable("MALFORMED_MESSAGE");
    }
    const result = await transaction(pool, (tx) => applyProcessing(tx, event));
    console.log(JSON.stringify({ videoId: event.videoId, eventId: event.eventId, ...result }));
  });
  await writeFile("/tmp/shell-ready", "ready\n");
  const result = await Promise.race([input.closed, publisher.closed]);
  if (result.fatal) process.exitCode = 1;
  await close();
} catch {
  console.error("Lifecycle startup/stopping failed; inspect migrations and broker readiness.");
  process.exitCode = 1;
  await close();
}

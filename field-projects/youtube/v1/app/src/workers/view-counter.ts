import { rm, writeFile } from "node:fs/promises";
import { connect } from "../clients/counter-consumer.ts";
import { connect as counts } from "../clients/counter-writer.ts";
import { parseMessage, viewPlayed } from "../contracts/v1.ts";
import { handle } from "../extensions/counter-sum.ts";
import { NonRetryable } from "../lib/amqp.ts";
const pool = counts();
pool.on("error", () => console.error("Counter database unavailable"));
let input: Awaited<ReturnType<typeof connect>> | undefined;
try {
  await rm("/tmp/shell-ready", { force: true });
  await pool.query("SELECT event_id FROM count_private.receipts LIMIT 0");
  input = await connect(async (body, delivery) => {
    let event;
    try {
      if (!delivery.messageId) throw new Error("Missing identity");
      event = viewPlayed.parse(parseMessage("view-events", body, delivery.messageId));
    } catch {
      throw new NonRetryable("MALFORMED_MESSAGE");
    }
    const counted = await handle(pool, event);
    console.log(JSON.stringify({ videoId: event.videoId, eventId: event.eventId, counted }));
  });
  await writeFile("/tmp/shell-ready", "ready\n");
  if ((await input.closed).fatal) process.exitCode = 1;
} catch {
  console.error("Counter failed; inspect counts migration/grants and broker readiness.");
  process.exitCode = 1;
} finally {
  await rm("/tmp/shell-ready", { force: true });
  await input?.close();
  await pool.end();
}

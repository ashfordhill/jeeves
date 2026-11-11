// Generated scaffold: View counter (Worker service) runs as app-view-counter, a worker process.
// Export rewrites this file. Write modules in src/modules/; .jeeves/report.json lists what runs.
import { pool, selected } from "../features/service-resources.ts";
import { viewCounterReceiptAndIncrementHooks } from "../modules/view-counter/view-counter-receipt-and-increment.hooks.ts";
import { startCounterWorker } from "../runtime/counter-worker.ts";
import { createEventCounter } from "../runtime/event-counter.ts";
import { runProcess } from "../runtime/process.ts";
import { createLoopLog, loopConsumer, templateHandler, watchHooks } from "../runtime/tile-loop.ts";
import { logStarted } from "../runtime/tile-process.ts";

/** Compiled configuration: nothing is read from disk at runtime. */
export const config = {
  "tile": "view-counter",
  "kind": "worker",
  "shape": "worker",
  "templates": {
    "view-counter-receipt-and-increment": {
      "template": "event-counter",
      "lead": "view-counter-receipt-and-increment",
      "tables": {
        "receipts": {
          "schema": "view_counter_receipt_and_increment",
          "table": "receipts"
        },
        "totals": {
          "schema": "view_counter_receipt_and_increment",
          "table": "totals"
        }
      }
    }
  },
  "loops": [
    {
      "module": "view-counter-receipt-and-increment",
      "queue": "view-events--view-counter",
      "failedQueue": "view-events--view-counter.failed",
      "retryLimit": 5,
      "concurrency": 8
    }
  ]
} as const;

await runProcess(async (scope) => {
  // Loops subscribe before the process is ready. "Not implemented" sends a message to its
  // queue's .failed with one log line per module and hook a second; stopping drains them.
  const loopLog = createLoopLog(config.tile);
  // Receipt and increment: the event counter's worker on its tables and its events subscriber.
  await (async () => {
    const s = selected("event-counter", "view-counter-receipt-and-increment");
    const binding = config.templates["view-counter-receipt-and-increment"];
    const db = pool(scope, s, "state");
    await db.query("SELECT 1");
    const worker = await startCounterWorker({
      pool: db,
      counter: createEventCounter(binding.tables, watchHooks(viewCounterReceiptAndIncrementHooks(), loopLog, "view-counter-receipt-and-increment")),
      openConsumer: (handle) =>
        loopConsumer(config.loops[0], templateHandler(loopLog, config.loops[0], handle), {
          onFatal: scope.fail,
        }),
    });
    scope.own(() => worker.close());
    scope.transport(worker);
  })();
  logStarted(config.tile, {"module":"view-counter-receipt-and-increment","template":"event-counter","wiring":"mounted","checks":["SELECT 1 on its state login","subscribed view-events--view-counter"]});
  scope.ready();
});

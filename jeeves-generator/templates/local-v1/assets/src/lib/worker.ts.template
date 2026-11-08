import { writeFileSync } from "node:fs";
import { consume } from "./amqp.ts";
import { Unimplemented } from "./env.ts";
export async function workerShell(
  id: string,
  queue: string,
  concurrency: number,
  retryLimit: number,
) {
  await consume(queue, concurrency, retryLimit, async () => {
    throw new Unimplemented(`${id} message handler`);
  });
  writeFileSync("/tmp/shell-ready", "connected; business handler unimplemented\n");
}

import { hostname } from "node:os";
import type { ModuleMessage } from "../entry.ts";
import type { Dependencies } from "./count.slots.ts";
export async function count(dependencies: Dependencies, message: ModuleMessage): Promise<void> {
  const { value } = JSON.parse(Buffer.from(message.body).toString()) as { value: string };
  const id = message.messageId;
  if (!id || typeof value !== "string") throw new Error("Invalid click identity");
  const delivered = () =>
    dependencies.tallyDb.execute(
      "INSERT INTO m_count.deliveries (message_id, attempt, worker) VALUES ($1,$2,$3)",
      [id, message.attempt, hostname()],
    );
  // The fixture's failures, chosen by the click's ID.
  if (id.startsWith("ni-")) throw new Error("Not implemented: counting ni- clicks");
  if (id.startsWith("retry-")) {
    await delivered();
    throw new Error(`Count refuses ${id}`);
  }
  // Pub/Sub delivers a message at least once: a click counts once, by its ID.
  await dependencies.tallyDb.execute(
    "INSERT INTO m_count.clicks (message_id, value, worker) VALUES ($1,$2,$3) ON CONFLICT (message_id) DO NOTHING",
    [id, value, hostname()],
  );
  await delivered();
}

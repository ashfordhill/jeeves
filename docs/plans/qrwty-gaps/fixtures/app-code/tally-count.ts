// Q03 probe body (application-owned file): record each message ID once.
import type { ModuleMessage } from "../entry.ts";
import type { Dependencies } from "./tally-count.slots.ts";

export async function tallyCount(d: Dependencies, message: ModuleMessage): Promise<void> {
  await d.tallyDb.execute(
    "INSERT INTO m_tally_count.seen(message_id, attempt) VALUES ($1, $2) ON CONFLICT (message_id) DO NOTHING",
    [message.messageId ?? "none", message.attempt],
  );
}

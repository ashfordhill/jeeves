import { hostname } from "node:os";
import type { ModuleMessage } from "../entry.ts";
import type { Dependencies } from "./audit.slots.ts";
export async function audit(dependencies: Dependencies, message: ModuleMessage): Promise<void> {
  const { value } = JSON.parse(Buffer.from(message.body).toString()) as {
    value: string;
  };
  if (!message.messageId || typeof value !== "string") throw new Error("Invalid effect identity");
  await dependencies.fanoutDb.execute(
    "INSERT INTO m_audit.effects (message_id, value, worker) VALUES ($1,$2,$3)",
    [message.messageId, value, hostname()],
  );
}

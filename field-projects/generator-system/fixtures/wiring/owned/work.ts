import { hostname } from "node:os";
import type { ModuleMessage } from "../entry.ts";
import type { Dependencies } from "./work.slots.ts";
export async function work(dependencies: Dependencies, message: ModuleMessage): Promise<void> {
  const { value } = JSON.parse(Buffer.from(message.body).toString()) as {
    value: string;
  };
  if (!message.messageId || typeof value !== "string") throw new Error("Invalid effect identity");
  await dependencies.workDb.execute(
    "INSERT INTO m_work.effects (message_id, value, worker) VALUES ($1,$2,$3)",
    [message.messageId, value, hostname()],
  );
}

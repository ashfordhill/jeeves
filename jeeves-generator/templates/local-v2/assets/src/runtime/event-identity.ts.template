import { createHash } from "node:crypto";
import { durableIdentity } from "./durable-sql.ts";

/** Namespace is explicitly application-bound; text parts retain case. Normalize domain UUIDs
 * with assetUuid before using them here. Narrow adapters may preserve existing event IDs. */
export function assetEventId(namespace: string, ...parts: string[]): string {
  const hash = createHash("sha256")
    .update(JSON.stringify([durableIdentity(namespace), ...parts.map(durableIdentity)]))
    .digest();
  hash[6] = (hash[6]! & 15) | 0x50;
  hash[8] = (hash[8]! & 63) | 0x80;
  const hex = hash.subarray(0, 16).toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

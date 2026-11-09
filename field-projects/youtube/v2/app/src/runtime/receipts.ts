import {
  durableIdentity,
  jsonPayload,
  qualifiedRelation,
  type SqlRelation,
} from "./durable-sql.ts";
import { abortTransaction, assertTransaction, type Tx } from "./transaction.ts";
import type { PayloadCodec } from "./outbox.ts";

/** Inbox/receipt and effect share this exact transaction. Await it and commit before ack.
 * Effects are compiled SQL adapters, never network publication or saved-source code. */
export function createReceipts<Payload, Result>(
  binding: SqlRelation,
  codec: {
    payload: PayloadCodec<Payload>;
    /** Validated stable business identity, excluding regenerated transport timestamps.
     * Default compares the complete parsed payload. Never omit fields relevant to the effect. */
    identity?: (payload: Payload) => unknown;
    result: (input: unknown) => Result;
  },
) {
  const table = qualifiedRelation(binding);
  return {
    async withEffect(
      tx: Tx,
      input: { scopeKey: string; eventId: string; payload: unknown },
      effect: (tx: Tx, payload: Payload) => Promise<Result>,
    ): Promise<{ applied: boolean; result: Result }> {
      assertTransaction(tx);
      try {
        const eventId = durableIdentity(input.eventId),
          scopeKey = durableIdentity(input.scopeKey);
        const parsed = codec.payload(input.payload, eventId),
          payload = jsonPayload(codec.identity ? codec.identity(parsed) : parsed);
        const inserted = await tx.query(
          `INSERT INTO ${table}(scope_key,event_id,payload) VALUES($1,$2,$3::jsonb) ON CONFLICT DO NOTHING RETURNING event_id`,
          [scopeKey, eventId, payload],
        );
        if (!inserted.rowCount) {
          const existing = await tx.query<{
            result: { value: unknown } | null;
          }>(
            `SELECT result FROM ${table} WHERE scope_key=$1 AND event_id=$2 AND payload=$3::jsonb`,
            [scopeKey, eventId, payload],
          );
          const row = existing.rows[0];
          if (!row?.result) throw new Error("Conflicting or incomplete receipt");
          return { applied: false, result: codec.result(row.result.value) };
        }
        const result = codec.result(await effect(tx, parsed));
        jsonPayload(result);
        await tx.query(`UPDATE ${table} SET result=$3::jsonb WHERE scope_key=$1 AND event_id=$2`, [
          scopeKey,
          eventId,
          jsonPayload({ value: result }),
        ]);
        return { applied: true, result };
      } catch (error) {
        // Even if an adapter catches this error, transaction() refuses to commit partial work.
        return abortTransaction(tx, error);
      }
    },
  };
}

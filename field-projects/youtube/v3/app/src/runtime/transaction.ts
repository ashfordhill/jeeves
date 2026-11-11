import type pg from "pg";

const transactionScope: unique symbol = Symbol("SQL transaction");
export interface Tx {
  readonly [transactionScope]: true;
  query<Row extends pg.QueryResultRow = pg.QueryResultRow>(
    sql: string,
    values?: unknown[],
  ): Promise<pg.QueryResult<Row>>;
}
export type TransactionPool = Pick<pg.Pool, "connect">;
const scopes = new WeakMap<Tx, { active: boolean; failure?: { error: unknown } }>();
export function assertTransaction(tx: Tx): void {
  const scope = scopes.get(tx);
  if (!scope?.active) throw new Error("SQL transaction is not active");
  if (scope.failure) throw scope.failure.error;
}
/** A failed atomic hook must not leave a receipt committed if its caller catches the error. */
export function abortTransaction(tx: Tx, error: unknown): never {
  const scope = scopes.get(tx);
  if (scope) scope.failure = { error };
  throw error;
}
export async function transaction<T>(
  pool: TransactionPool,
  effect: (tx: Tx) => Promise<T>,
): Promise<T> {
  const client = await pool.connect();
  const scope = { active: true };
  const tx: Tx = Object.freeze({
    [transactionScope]: true as const,
    query<Row extends pg.QueryResultRow>(sql: string, values?: unknown[]) {
      assertTransaction(tx);
      return client.query<Row>(sql, values).catch((error: unknown) => abortTransaction(tx, error));
    },
  });
  scopes.set(tx, scope);
  let began = false,
    discard = false;
  try {
    await client.query("BEGIN");
    began = true;
    const result = await effect(tx);
    assertTransaction(tx);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    if (began) {
      try {
        await client.query("ROLLBACK");
      } catch {
        discard = true;
      }
    } else discard = true;
    throw error;
  } finally {
    scope.active = false;
    client.release(discard);
  }
}

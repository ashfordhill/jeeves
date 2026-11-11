import type pg from "pg";
import { durableIdentity, qualifiedRelation, type SqlRelation } from "./durable-sql.ts";

/** Bind only a public totals view and its separate read login. Totals never enter metadata cache. */
export function createTotalReader<Input>(options: {
  pool: Pick<pg.Pool, "query">;
  view: SqlRelation;
  key(input: Input): string;
}) {
  const view = qualifiedRelation(options.view);
  return async (input: Input): Promise<string> => {
    const key = durableIdentity(options.key(input));
    const result = await options.pool.query<{ total: string }>(
      `SELECT total::text AS total FROM ${view} WHERE aggregate_key=$1`,
      [key],
    );
    const total = result.rows[0]?.total ?? "0";
    if (!/^(0|[1-9][0-9]*)$/.test(total)) throw new Error("Invalid counter total");
    return total;
  };
}

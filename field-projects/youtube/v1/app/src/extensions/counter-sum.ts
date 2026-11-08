import type pg from "pg";
import { type ViewPlayed } from "../contracts/v1.ts";
import { recordView } from "../state/counts.ts";
import { transaction } from "../state/transaction.ts";
// One durable receipt and increment per event; no metadata grant or cached totals.
export const handle = (pool: pg.Pool, input: ViewPlayed) =>
  transaction(pool, (tx) => recordView(tx, input));

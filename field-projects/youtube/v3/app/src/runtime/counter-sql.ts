import { qualifiedRelation, receiptSchema, type SqlRelation } from "./durable-sql.ts";
import { quoteSqlIdentifier } from "./local.ts";

export interface CounterTables {
  receipts: SqlRelation;
  totals: SqlRelation;
}
export function validateCounterTables(binding: CounterTables): void {
  if (qualifiedRelation(binding.receipts) === qualifiedRelation(binding.totals))
    throw new Error("Counter receipts and totals must differ");
}
export function counterSchema(binding: CounterTables, publicView: SqlRelation): string {
  validateCounterTables(binding);
  const view = qualifiedRelation(publicView);
  if ([qualifiedRelation(binding.receipts), qualifiedRelation(binding.totals)].includes(view))
    throw new Error("Counter public view must differ from private tables");
  return `${receiptSchema(binding.receipts)}
CREATE SCHEMA IF NOT EXISTS ${quoteSqlIdentifier(binding.totals.schema)};
REVOKE ALL ON SCHEMA ${quoteSqlIdentifier(binding.totals.schema)} FROM PUBLIC;
CREATE TABLE ${qualifiedRelation(binding.totals)} (
 aggregate_key text PRIMARY KEY CHECK(length(aggregate_key) BETWEEN 1 AND 512),
 total bigint NOT NULL CHECK(total>=0)
);
CREATE SCHEMA IF NOT EXISTS ${quoteSqlIdentifier(publicView.schema)};
REVOKE ALL ON SCHEMA ${quoteSqlIdentifier(publicView.schema)} FROM PUBLIC;
`;
}
/** Foundation owns CREATE VIEW and grants; this projection contains no private receipt data. */
export const counterTotalsSelect = (binding: CounterTables): string => {
  validateCounterTables(binding);
  return `SELECT aggregate_key,total FROM ${qualifiedRelation(binding.totals)}`;
};

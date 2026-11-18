import { generationRuntime } from "@jeeves/spec";
import {
  type CounterTables,
  counterSchema,
  counterTotalsSelect,
} from "../../templates/local-v2/assets/src/runtime/counter-sql.ts";
import {
  qualifiedRelation,
  receiptLifecycleSchema,
} from "../../templates/local-v2/assets/src/runtime/durable-sql.ts";
import { pointerPart } from "../json.ts";
import type { SqlRelation } from "./durability.ts";
import type { V2LocalContribution } from "./local-contract.ts";
import { mountedHooksGap } from "./module-stubs.ts";
import type { V2Emitter } from "./registry.ts";

export { type CounterTables, counterSchema, counterTotalsSelect };

/** Compiled recipes name actual tables, projection and runtime hosts. The foundation validates
 * these against explicit selected ownership/access; labels never imply permission. */
export function eventCounterPersistence(binding: {
  resource: string;
  writerHost: string;
  tables: CounterTables;
  publicView: SqlRelation;
  migrationId: string;
  sourcePaths: readonly string[];
}): V2LocalContribution {
  return {
    sourcePaths: binding.sourcePaths,
    migrations: [
      {
        resource: binding.resource,
        id: binding.migrationId,
        sql: counterSchema(binding.tables, binding.publicView),
      },
      {
        resource: binding.resource,
        id: `101-${binding.migrationId.replace(/^\d+-/, "").replace(/\.sql$/, "")}-receipt-lifecycle.sql`,
        sql: counterReceiptUpgrade(binding.tables),
      },
    ],
    views: [
      {
        resource: binding.resource,
        schema: binding.publicView.schema,
        name: binding.publicView.table,
        selectSql: counterTotalsSelect(binding.tables),
      },
    ],
    logins: [{ resource: binding.resource, host: binding.writerHost }],
    grants: [
      binding.tables.receipts,
      binding.tables.totals,
      { ...binding.tables.receipts, table: `${binding.tables.receipts.table}_maintenance` },
      { ...binding.tables.receipts, table: `${binding.tables.receipts.table}_workers` },
    ].map((relation) => ({
      resource: binding.resource,
      host: binding.writerHost,
      schema: relation.schema,
      relation: relation.table,
      kind: "table",
      privileges:
        relation.table === binding.tables.totals.table
          ? ["SELECT", "INSERT", "UPDATE"]
          : ["SELECT", "INSERT", "UPDATE", "DELETE"],
    })),
  };
}
export function counterReceiptUpgrade(tables: CounterTables): string {
  const table = qualifiedRelation(tables.receipts);
  return `DO $$ BEGIN
 IF EXISTS(SELECT event_id FROM ${table} GROUP BY event_id HAVING count(*)>1) THEN
  RAISE EXCEPTION 'COUNTER_LEGACY_DUPLICATE_ID_REQUIRES_RECONCILIATION';
 END IF;
END $$;
UPDATE ${table} SET scope_key='event-counter-v2';
CREATE UNIQUE INDEX ON ${table}(event_id);
${receiptLifecycleSchema(tables.receipts, 604800)}`;
}
export function eventCounterReadAccess(binding: {
  resource: string;
  host: string;
  publicView: SqlRelation;
  sourcePaths: readonly string[];
}): V2LocalContribution {
  return {
    sourcePaths: binding.sourcePaths,
    logins: [{ resource: binding.resource, host: binding.host }],
    grants: [
      {
        resource: binding.resource,
        host: binding.host,
        schema: binding.publicView.schema,
        relation: binding.publicView.table,
        kind: "view",
        privileges: ["SELECT"],
      },
    ],
  };
}
export function createLocalEventCounter(sourcePaths: readonly string[]): V2Emitter {
  return {
    id: "local.event-counter",
    version: "0.1.0-experimental.1",
    status: "implemented",
    description: "Receipt-based one-event increments, public totals and bound consumer dependency.",
    sourcePaths,
    dependencies: [generationRuntime.ref],
    local: ({ model }) => {
      const selections = model.selections.filter((s) => s.binding.kind === "event-counter");
      if (!selections.length) return undefined;
      return {
        sourcePaths: selections.map(
          (s) => `/${s.sourcePath.map((p) => pointerPart(String(p))).join("/")}`,
        ),
        broker: selections.map((s) => {
          const events = s.resources.find((r) => r.field === "events");
          if (!events) throw new Error("Normalized counter events required");
          return { resource: events.identity.local, host: s.host };
        }),
      };
    },
    render: ({ model, asset }) => {
      const selections = model.selections.filter((s) => s.binding.kind === "event-counter");
      const paths = selections.map(
        (s) => `/${s.sourcePath.map((p) => pointerPart(String(p))).join("/")}`,
      );
      if (!paths.length) return { files: [] };
      return {
        files: ["counter-sql", "counter-read", "event-counter", "counter-worker"].map((name) => ({
          path: `src/runtime/${name}.ts`,
          content: asset(
            `jeeves-generator/templates/local-v2/assets/src/runtime/${name}.ts${name === "counter-sql" ? "" : ".template"}`,
          ),
          ownership: "generated-scaffold" as const,
          sourcePaths: paths,
        })),
        gaps: [
          mountedHooksGap(
            model,
            selections,
            {
              id: "event-counter-application-bindings",
              required: true,
              status: "unfinished" as const,
              description:
                "Bind an actual qualifying event codec/stable identity, explicit counter tables/public view/runtime access, and construct the counter consumer and fresh totals reader in compiled services. Dependency output alone installs no application.",
              sourcePaths: paths,
            },
            "a message that reaches one ends in its queue's .failed",
          ),
        ],
      };
    },
  };
}

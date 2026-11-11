import { generationRuntime } from "@jeeves/spec";
import { pointerPart } from "../json.ts";
import type { V2Emitter } from "./registry.ts";

// These exact dependency-free sources also ship in the standalone project. Compiled
// adapters can contribute their SQL through V2Emitter.local; saved source cannot supply code.
export {
  type OutboxTable,
  outboxSchema,
  receiptSchema,
  type SqlRelation,
} from "../../templates/local-v2/assets/src/runtime/durable-sql.ts";

export function createLocalDurability(sourcePaths: readonly string[]): V2Emitter {
  return {
    id: "local.durability",
    version: "0.1.0-experimental.1",
    status: "implemented",
    description:
      "Transaction, bound outbox relay and receipt-with-effect dependency libraries only.",
    sourcePaths,
    dependencies: [generationRuntime.ref],
    render: ({ model, asset }) => {
      const selected = model.selections.filter((s) =>
        ["owned-multipart", "asset-lifecycle", "event-counter", "favorites"].includes(
          s.binding.kind,
        ),
      );
      const paths = selected.map(
        (s) => `/${s.sourcePath.map((part) => pointerPart(String(part))).join("/")}`,
      );
      if (!paths.length) return { files: [] };
      // Favorites needs only transactions and qualified tables: no outbox or receipts.
      const messaging = selected.some((s) => s.binding.kind !== "favorites");
      return {
        files: ["transaction", "durable-sql", ...(messaging ? ["outbox", "receipts"] : [])].map(
          (name) => ({
            path: `src/runtime/${name}.ts`,
            content: asset(
              `jeeves-generator/templates/local-v2/assets/src/runtime/${name}.ts${name === "durable-sql" ? "" : ".template"}`,
            ),
            ownership: "generated-scaffold" as const,
            sourcePaths: paths,
          }),
        ),
      };
    },
  };
}

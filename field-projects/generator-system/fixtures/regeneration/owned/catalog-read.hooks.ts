import type pg from "pg";
import type { PositiveReadAdapter } from "../../runtime/positive-cache.ts";

type Record = { id: string; title: string; state: "published" };
export function catalogReadHooks(resources: {
  source: pg.Pool;
}): PositiveReadAdapter<{ key: string }, Record> {
  return {
    key: ({ key }) => `catalog:${key}`,
    codec: {
      parse(value) {
        const record = value as Record;
        if (
          !record ||
          typeof record.id !== "string" ||
          typeof record.title !== "string" ||
          record.state !== "published"
        )
          throw new Error("Invalid public catalog record");
        return { id: record.id, title: record.title, state: record.state };
      },
    },
    eligible: (record, input) => record.id === input.key && record.state === "published",
    async load({ key }) {
      console.log(JSON.stringify({ event: "catalog-load", key }));
      return (
        (
          await resources.source.query(
            "SELECT id, title, state FROM published.catalog WHERE id=$1",
            [key],
          )
        ).rows[0] ?? null
      );
    },
    expiresAt: () => null,
  };
}

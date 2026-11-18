// @jeeves-extension: operation
import { parseRecord, type RecordValue } from "../../contracts/record.ts";
import type { PositiveReadAdapter, ProductQueries } from "../../extension-api/index.ts";
export function recordReaderHooks(resources: {
  source: ProductQueries;
}): PositiveReadAdapter<{ key: string }, RecordValue> {
  return {
    key: (input) => input.key,
    codec: { parse: parseRecord },
    eligible: (record, input) => record.key === input.key && record.public,
    expiresAt: (record) => record.validUntil,
    version: (record) => record.version,
    async load(input) {
      const answer = await resources.source.call("read_record", [input.key]);
      return (answer.rows[0] as { payload?: unknown } | undefined)?.payload ?? null;
    },
  };
}

// @jeeves-extension: operation

import { type PublicRecord, parseRecord } from "../../contracts/record.ts";
import type { PositiveReadAdapter, ProductQueries } from "../../extension-api/index.ts";
export function previewReaderHooks(resources: {
  source: ProductQueries;
}): PositiveReadAdapter<{ key: string }, PublicRecord> {
  return {
    key: (input) => `records:v1:${input.key}`,
    codec: { parse: parseRecord },
    eligible: (record, input) => record.key === input.key && record.public,
    async load(input) {
      const result = await resources.source.call("read_record", [input.key]);
      const row = result.rows[0] as { payload?: unknown } | undefined;
      return row?.payload ?? null;
    },
    expiresAt: (record) => record.validUntil,
    version: (record) => record.version,
  };
}

import { postgres } from "../lib/postgres.ts";
export const connect = () =>
  postgres("metadata", "metadata_upload", "metadata_upload", {
    poolSize: 10,
    statementTimeoutMs: 2000,
  });

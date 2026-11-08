import { postgres } from "../lib/postgres.ts";
export const connect = () =>
  postgres("metadata", "metadata_lifecycle", "metadata_lifecycle", {
    poolSize: 10,
    statementTimeoutMs: 2000,
  });

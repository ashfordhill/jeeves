import { postgres } from "../lib/postgres.ts";
export const connect = () =>
  postgres("counts", "counts_writer", "counts_writer", { poolSize: 10, statementTimeoutMs: 2000 });

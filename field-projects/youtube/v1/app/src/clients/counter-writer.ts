import { postgres } from "../lib/postgres.ts";
export const connect = () => postgres("counts","counts_owner","counts_owner",{
  "poolSize": 10,
  "statementTimeoutMs": 2000
});

import { postgres } from "../lib/postgres.ts";
export const connect = () => postgres("counts","counts_reader","counts_reader",{
  "poolSize": 20,
  "statementTimeoutMs": 500
});

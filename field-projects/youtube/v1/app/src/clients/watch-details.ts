import { postgres } from "../lib/postgres.ts";
export const connect = () => postgres("metadata","metadata_reader","metadata_reader",{
  "poolSize": 50,
  "statementTimeoutMs": 500
});

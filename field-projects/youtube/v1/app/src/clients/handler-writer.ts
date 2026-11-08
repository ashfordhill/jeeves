import { postgres } from "../lib/postgres.ts";
export const connect = () => postgres("metadata","metadata_owner","metadata_owner",{
  "poolSize": 10,
  "statementTimeoutMs": 2000
});

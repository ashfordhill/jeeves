import pg from "pg";
import { secret } from "./env.ts";
export function postgres(
  database: string,
  role: string,
  passwordSecret: string,
  settings: { poolSize: number; statementTimeoutMs: number },
) {
  return new pg.Pool({
    host: "postgres",
    port: 5432,
    database,
    user: role,
    password: secret(passwordSecret),
    max: settings.poolSize,
    statement_timeout: settings.statementTimeoutMs,
    connectionTimeoutMillis: 5000,
  });
}

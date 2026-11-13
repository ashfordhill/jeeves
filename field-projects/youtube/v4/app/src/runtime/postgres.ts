import pg from "pg";
import { readSecret, type SqlLogin } from "./local.ts";

/** Use the exact foundation login, never compose names in a domain adapter. The plan's
 * login.host is the application host; hostname is the explicit database network endpoint. */
export function createPostgres(options: {
  hostname: string;
  port: number;
  login: Pick<SqlLogin, "database" | "user" | "secret">;
  poolSize: number;
  statementTimeoutMs: number;
  connectionTimeoutMs: number;
  credential?: (secret: string) => string;
}) {
  return new pg.Pool({
    host: options.hostname,
    port: options.port,
    database: options.login.database,
    user: options.login.user,
    password: (options.credential ?? readSecret)(options.login.secret),
    max: options.poolSize,
    statement_timeout: options.statementTimeoutMs,
    connectionTimeoutMillis: options.connectionTimeoutMs,
  });
}

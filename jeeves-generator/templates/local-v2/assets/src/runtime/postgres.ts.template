import { checkServerIdentity, type PeerCertificate } from "node:tls";
import pg from "pg";
import { readSecret, type SqlLogin } from "./local.ts";

/** How a pool reaches its database (QG10). `disable`: plain TCP or a Unix socket, and `pg` gets
 * `ssl: false`, so `PGSSLMODE` can't change it. `verify-full`: TLS that checks the server's
 * certificate chain against `ca` (PEM; else Node's roots) and its name against the host, or
 * against `servername` when the certificate carries another name (a managed instance reached by a
 * private address). No value turns verification off. */
export type DatabaseTls =
  | { mode: "disable" }
  | { mode: "verify-full"; ca?: string; servername?: string };

/** `pg`'s `ssl` for a transport. `pg` sends a host name as the TLS server name and checks it, so a
 * given `servername` is checked by `checkServerIdentity` itself. */
export function postgresSsl(tls: DatabaseTls) {
  if (tls.mode !== "verify-full") return false as const;
  const { ca, servername } = tls;
  return {
    rejectUnauthorized: true,
    ...(ca !== undefined && { ca }),
    ...(servername !== undefined && {
      servername,
      checkServerIdentity: (_host: string, certificate: PeerCertificate) =>
        checkServerIdentity(servername, certificate),
    }),
  };
}

/** Use the exact foundation login, never compose names in a domain adapter. The plan's
 * login.host is the application host; hostname is the explicit database network endpoint. */
export function createPostgres(options: {
  hostname: string;
  port: number;
  tls: DatabaseTls;
  login: Pick<SqlLogin, "database" | "user" | "secret">;
  poolSize: number;
  statementTimeoutMs: number;
  connectionTimeoutMs: number;
  credential?: (secret: string) => string;
}) {
  return new pg.Pool({
    host: options.hostname,
    port: options.port,
    ssl: postgresSsl(options.tls),
    database: options.login.database,
    user: options.login.user,
    password: (options.credential ?? readSecret)(options.login.secret),
    max: options.poolSize,
    statement_timeout: options.statementTimeoutMs,
    // The server enforces statement_timeout (57014); one that stops answering can't. 500 ms later
    // the client rejects "Query read timeout" and the pool discards that connection.
    query_timeout: options.statementTimeoutMs + 500,
    connectionTimeoutMillis: options.connectionTimeoutMs,
  });
}

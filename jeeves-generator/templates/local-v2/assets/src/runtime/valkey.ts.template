import { readFileSync } from "node:fs";
import { createClient } from "redis";
import { readSecret } from "./local.ts";

/** How a client reaches its cache (QG10). `disable`: plain TCP. `verify-full`: TLS that checks the
 * server's certificate chain against `ca` (PEM; else Node's roots) and its name against the host,
 * or against `servername` when the certificate carries another name (a managed instance reached by
 * a private address). No value turns verification off. */
export type CacheTls =
  | { mode: "disable" }
  | { mode: "verify-full"; ca?: string; servername?: string };
export type ValkeyBinding = { hostname: string; port: number; secret: string; tls: CacheTls };

/** The bounded cache. The cache read's reader uses `get` and `set` with an absolute expiry
 * (`{ PXAT }`, its `PositiveCache`); a stub's cache client also uses `set` with seconds
 * (`{ EX }`) or no expiry, `delete`, and `ping` for its startup probe. */
export interface ValkeyCache {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, expiry?: { PXAT: number } | { EX: number }): Promise<unknown>;
  delete(key: string): Promise<unknown>;
  ping(): Promise<unknown>;
  close(): void;
}

/** A host is 1–253 letters, digits, `.` or `-`; a port an integer 1–65535. */
const validHost = (hostname: string) => /^[A-Za-z0-9.-]{1,253}$/.test(hostname);
const validPort = (port: number) => Number.isInteger(port) && port >= 1 && port <= 65535;

/** `JEEVES_REQUIRE_TLS` (QG10): `true` makes startup refuse a plain-text endpoint (`Insecure
 * endpoint <variable>`); absent, nothing is refused; any other value fails naming it. */
function requireTls(): boolean {
  const value = process.env.JEEVES_REQUIRE_TLS;
  if (value === undefined) return false;
  if (value === "true") return true;
  throw new Error("Invalid endpoint JEEVES_REQUIRE_TLS");
}

/** A CA file's PEM, read when the client is built: one that can't be read fails startup naming
 * its variable (and the error code), never the path. */
function readCa(path: string, variable: string): string {
  try {
    return readFileSync(path, "utf8");
  } catch (error) {
    const code = (error as { code?: unknown } | null)?.code;
    throw new Error(
      `Unreadable CA file ${variable}${typeof code === "string" && /^E[A-Z]+$/.test(code) ? ` (${code})` : ""}`,
    );
  }
}

/** A cache tile's endpoint from the process's environment (`<ID>` the tile ID upper-cased, `-` as
 * `_`), read when its client is built: `JEEVES_CACHE_<ID>_HOST`, `_PORT` and `_TLS` (`disable` or
 * `verify-full`); with `verify-full`, optionally `_CA_FILE` (a PEM file, else Node's roots) and
 * `_TLS_SERVERNAME` (the name the certificate carries when it isn't the host, by the host rule).
 * There is no
 * default: a missing or invalid value fails naming the variable, never the value. With
 * `JEEVES_REQUIRE_TLS=true`, `disable` fails `Insecure endpoint JEEVES_CACHE_<ID>_TLS`. */
export function cacheEndpoint(cache: string): { hostname: string; port: number; tls: CacheTls } {
  const name = (part: string) => `JEEVES_CACHE_${cache.toUpperCase().replace(/-/g, "_")}_${part}`;
  const hostname = process.env[name("HOST")];
  if (hostname === undefined || !validHost(hostname))
    throw new Error(`Invalid endpoint ${name("HOST")}`);
  const port = process.env[name("PORT")];
  if (port === undefined || !/^[1-9][0-9]{0,4}$/.test(port) || !validPort(Number(port)))
    throw new Error(`Invalid endpoint ${name("PORT")}`);
  const strict = requireTls();
  const mode = process.env[name("TLS")];
  if (mode !== "disable" && mode !== "verify-full") throw new Error(`Invalid endpoint ${name("TLS")}`);
  if (mode === "disable") {
    if (strict) throw new Error(`Insecure endpoint ${name("TLS")}`);
    return { hostname, port: Number(port), tls: { mode } };
  }
  const servername = process.env[name("TLS_SERVERNAME")];
  if (servername !== undefined && !validHost(servername))
    throw new Error(`Invalid endpoint ${name("TLS_SERVERNAME")}`);
  const caFile = process.env[name("CA_FILE")];
  return {
    hostname,
    port: Number(port),
    tls: {
      mode,
      ...(caFile !== undefined && { ca: readCa(caFile, name("CA_FILE")) }),
      ...(servername !== undefined && { servername }),
    },
  };
}

/** Startup cache failure is optional. No offline queue, client reconnect or hidden default
 * endpoint: a lost client is destroyed and a new one connects every five seconds. Each command
 * settles within 150 ms; at most 32 wait. Use the emitted normalized binding, with its host, port
 * and transport from `cacheEndpoint`: `verify-full` connects with TLS that rejects an unverified
 * certificate. The caller owns close alongside its HTTP service. */
export async function createValkeyCache(options: {
  binding: ValkeyBinding;
  credential?: (secret: string) => string;
  /** Told when the cache becomes available or unavailable, starting with the first connect. */
  onState?: (state: "available" | "unavailable", error?: unknown) => void;
}): Promise<ValkeyCache> {
  const { hostname, port, secret, tls } = options.binding;
  if (!validHost(hostname) || !validPort(port)) throw new Error("Invalid cache endpoint");
  const password = (options.credential ?? readSecret)(secret);
  const tcp = { host: hostname, port, connectTimeout: 500, reconnectStrategy: false as const };
  const socket =
    tls?.mode === "verify-full"
      ? {
          ...tcp,
          tls: true as const,
          rejectUnauthorized: true,
          ...(tls.ca !== undefined && { ca: tls.ca }),
          ...(tls.servername !== undefined && { servername: tls.servername }),
        }
      : tcp;
  const open = () =>
    createClient({ password, disableOfflineQueue: true, commandsQueueMaxLength: 32, socket });
  // One client generation at a time, active or still connecting. Every error handler, connect
  // result and command result belongs to its generation and is ignored once that generation is
  // no longer current or the cache is closed.
  type Generation = { client: ReturnType<typeof open>; ready: boolean };
  let current: Generation | undefined;
  let retry: ReturnType<typeof setTimeout> | undefined;
  let closed = false;
  let reported: "available" | "unavailable" | undefined;
  const report = (state: "available" | "unavailable", error?: unknown) => {
    if (state === reported) return;
    reported = state;
    try {
      options.onState?.(state, error);
    } catch {
      /* The cache goes on as it would without the report. */
    }
  };
  const destroy = (generation: Generation) => {
    try {
      generation.client.destroy();
    } catch {
      /* Already destroyed. */
    }
  };
  const retryLater = () => {
    if (closed || retry) return;
    retry = setTimeout(() => {
      retry = undefined;
      if (!closed) connect().catch(retryLater);
    }, 5000);
  };
  // The current generation is lost: destroy its client and try a new one in five seconds.
  const lose = (generation: Generation, error: unknown) => {
    if (closed || generation !== current) return;
    current = undefined;
    destroy(generation);
    report("unavailable", error);
    retryLater();
  };
  async function bounded<T>(
    generation: Generation,
    effect: () => Promise<T>,
    milliseconds: number,
  ): Promise<T> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      return await Promise.race([
        Promise.resolve().then(effect),
        new Promise<never>((_, reject) => {
          timer = setTimeout(() => reject(new Error("Cache deadline")), milliseconds);
        }),
      ]);
    } catch (error) {
      lose(generation, error);
      throw error;
    } finally {
      clearTimeout(timer);
    }
  }
  async function connect() {
    const generation: Generation = { client: open(), ready: false };
    generation.client.on("error", (error: unknown) => lose(generation, error));
    current = generation;
    try {
      await bounded(generation, () => generation.client.connect(), 500);
    } catch {
      // Lost already: a command rejects as unavailable until a new client connects (the reader
      // reads its primary meanwhile).
      return;
    }
    if (closed || generation !== current) {
      // Closed or lost while connecting: this client is never used.
      destroy(generation);
      return;
    }
    generation.ready = true;
    report("available");
  }
  await connect();
  const command = <T>(effect: (client: Generation["client"]) => Promise<T>) => {
    const generation = current;
    if (!generation?.ready) return Promise.reject(new Error("Cache unavailable"));
    return bounded(generation, () => effect(generation.client), 150);
  };
  return {
    get: (key) => command((client) => client.get(key)),
    set: (key, value, expiry) => command((client) => client.set(key, value, expiry)),
    delete: (key) => command((client) => client.del(key)),
    ping: () => command((client) => client.ping()),
    close: () => {
      closed = true;
      clearTimeout(retry);
      retry = undefined;
      if (current) destroy(current);
      current = undefined;
    },
  };
}

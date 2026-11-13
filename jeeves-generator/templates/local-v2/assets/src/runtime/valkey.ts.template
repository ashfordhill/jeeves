import { createClient } from "redis";
import { readSecret } from "./local.ts";
import type { PositiveCache } from "./positive-cache.ts";

export type ValkeyBinding = { hostname: string; port: number; secret: string };

/** Startup cache failure is optional. No offline queue, client reconnect or hidden default
 * endpoint: a lost client is destroyed and a new one connects every five seconds. Use the emitted
 * normalized binding; the caller owns close alongside its HTTP service. */
export async function createValkeyCache(options: {
  binding: ValkeyBinding;
  credential?: (secret: string) => string;
  /** Told when the cache becomes available or unavailable, starting with the first connect. */
  onState?: (state: "available" | "unavailable", error?: unknown) => void;
}): Promise<PositiveCache & { close(): void }> {
  const { hostname, port, secret } = options.binding;
  if (!/^[a-z][a-z0-9.-]{0,254}$/.test(hostname) || !Number.isInteger(port) || port < 1 || port > 65535)
    throw new Error("Invalid cache endpoint");
  const password = (options.credential ?? readSecret)(secret);
  const open = () =>
    createClient({
      password,
      disableOfflineQueue: true,
      commandsQueueMaxLength: 32,
      socket: { host: hostname, port, connectTimeout: 500, reconnectStrategy: false },
    });
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
      // Lost already; the reader falls back to primary while a command rejects as unavailable.
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
    close: () => {
      closed = true;
      clearTimeout(retry);
      retry = undefined;
      if (current) destroy(current);
      current = undefined;
    },
  };
}

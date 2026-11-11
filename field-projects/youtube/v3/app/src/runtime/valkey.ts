import { createClient } from "redis";
import { readSecret } from "./local.ts";
import type { PositiveCache } from "./positive-cache.ts";

export type ValkeyBinding = { hostname: string; port: number; secret: string };

/** Startup cache failure is optional. No offline queue, reconnect or hidden default endpoint.
 * Use the emitted normalized binding; the caller owns close alongside its HTTP service. */
export async function createValkeyCache(options: {
  binding: ValkeyBinding;
  credential?: (secret: string) => string;
}): Promise<PositiveCache & { close(): void }> {
  const { hostname, port, secret } = options.binding;
  if (!/^[a-z][a-z0-9.-]{0,254}$/.test(hostname) || !Number.isInteger(port) || port < 1 || port > 65535)
    throw new Error("Invalid cache endpoint");
  const client = createClient({
    password: (options.credential ?? readSecret)(secret),
    disableOfflineQueue: true,
    commandsQueueMaxLength: 32,
    socket: { host: hostname, port, connectTimeout: 500, reconnectStrategy: false },
  });
  let usable = false;
  const close = () => {
    usable = false;
    if (client.isOpen) client.destroy();
  };
  client.on("error", close);
  async function bounded<T>(effect: () => Promise<T>, milliseconds: number): Promise<T> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      return await Promise.race([
        Promise.resolve().then(effect),
        new Promise<never>((_, reject) => {
          timer = setTimeout(() => {
            close();
            reject(new Error("Cache deadline"));
          }, milliseconds);
        }),
      ]);
    } catch (error) {
      close();
      throw error;
    } finally {
      clearTimeout(timer);
    }
  }
  try {
    await bounded(() => client.connect(), 500);
    usable = true;
  } catch {
    // The reader falls back to primary when a command rejects as unavailable.
  }
  const command = <T>(effect: () => Promise<T>) => {
    if (!usable) return Promise.reject(new Error("Cache unavailable"));
    return bounded(effect, 150);
  };
  return {
    get: (key) => command(() => client.get(key)),
    set: (key, value, expiry) => command(() => client.set(key, value, expiry)),
    close,
  };
}

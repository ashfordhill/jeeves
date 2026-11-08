import { createClient } from "redis";
import { secret } from "./env.ts";
export async function cache() {
  const client = createClient({
    url: "redis://cache:6379",
    password: secret("cache_password"),
    socket: { connectTimeout: 5000, reconnectStrategy: false },
  });
  client.on("error", () => console.error("Cache connection error"));
  await client.connect();
  return client;
}
// No cache-aside, TTL-on-write or single-flight policy is inferred.

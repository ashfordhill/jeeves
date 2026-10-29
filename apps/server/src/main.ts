import { readFileSync } from "node:fs";
import { buildApp } from "./app.ts";
import { loadConfig } from "./config.ts";
import { connectDb } from "./db/client.ts";

const { version } = JSON.parse(
  readFileSync(new URL("../package.json", import.meta.url), "utf8"),
) as { version: string };

const config = loadConfig();
const db = connectDb(config.databaseUrl);
const app = buildApp({ pingDb: db.ping, version, logger: true });

const shutdown = async () => {
  await app.close();
  await db.close();
  process.exit(0);
};
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

await app.listen({ host: config.host, port: config.port });

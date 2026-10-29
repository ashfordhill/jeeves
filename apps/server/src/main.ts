import { readFileSync } from "node:fs";
import { buildApp } from "./app.ts";
import { fakeModels } from "./chat/models.ts";
import { failInterruptedTurns } from "./chat/service.ts";
import { loadConfig } from "./config.ts";
import { connectDb } from "./db/client.ts";
import { jeevesHome, Settings } from "./settings.ts";

const { version } = JSON.parse(
  readFileSync(new URL("../package.json", import.meta.url), "utf8"),
) as { version: string };

const config = loadConfig();
const db = connectDb(config.databaseUrl);
// Local single-user app: bring the schema up to date on every start.
await db.migrate();
await failInterruptedTurns(db.db);
// e2e tests replay a scripted model instead of calling a provider.
const fakeScript = process.env.JEEVES_FAKE_MODEL_SCRIPT;
const settings = new Settings(jeevesHome(), process.env, !!fakeScript);
const app = buildApp({
  db: db.db,
  pingDb: db.ping,
  version,
  settings,
  models: fakeScript ? fakeModels(fakeScript) : undefined,
  logger: true,
});

const shutdown = async () => {
  await app.close();
  await db.close();
  process.exit(0);
};
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

await app.listen({ host: config.host, port: config.port });

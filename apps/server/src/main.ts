import { readFileSync } from "node:fs";
import {
  createAgentExecutor,
  markerChecks,
  projectChecks,
  stubExecutor,
} from "@jeeves/orchestrator";
import { buildApp } from "./app.ts";
import { fakeModels, providerModels } from "./chat/models.ts";
import { failInterruptedTurns } from "./chat/service.ts";
import { loadConfig } from "./config.ts";
import { connectDb, ensureDatabase } from "./db/client.ts";
import { failInterruptedGenerations } from "./generate/service.ts";
import { codingAgents, fakeCodingAgents } from "./runs/agents.ts";
import { pgBossJobs } from "./runs/jobs.ts";
import { recoverRuns, requeuePlanning } from "./runs/service.ts";
import { jeevesHome, Settings } from "./settings.ts";

const { version } = JSON.parse(
  readFileSync(new URL("../package.json", import.meta.url), "utf8"),
) as { version: string };

const config = loadConfig();
// e2e tests use their own database, so a dev server and a test server never share runs or jobs.
await ensureDatabase(config.databaseUrl);
const db = connectDb(config.databaseUrl);
// Local single-user app: bring the schema up to date on every start.
await db.migrate();
await failInterruptedTurns(db.db);
await failInterruptedGenerations(db.db);
await recoverRuns(db.db);
// Run planning and steps are pg-boss jobs in the same database (schema `pgboss`).
const jobs = await pgBossJobs({ connectionString: config.databaseUrl }, (err) =>
  console.error("pg-boss:", err),
);
// e2e tests replay a scripted model instead of calling a provider.
const fakeScript = process.env.JEEVES_FAKE_MODEL_SCRIPT;
const settings = new Settings(jeevesHome(), process.env, !!fakeScript);
const app = buildApp({
  db: db.db,
  pingDb: db.ping,
  version,
  settings,
  models: fakeScript
    ? fakeModels(fakeScript)
    : providerModels(settings, process.env.JEEVES_CODEX_PATH),
  jobs,
  executor: executor(),
  logger: true,
});

/**
 * Tasks run Codex and then Jeeves's checks. e2e tests script the agent
 * (`JEEVES_FAKE_CODING_SCRIPT`) and use quick marker checks instead of Docker
 * (`JEEVES_FAKE_CHECKS`); `JEEVES_STUB_EXECUTOR=1` skips agents altogether.
 */
function executor() {
  if (process.env.JEEVES_STUB_EXECUTOR === "1") {
    return stubExecutor(Number(process.env.JEEVES_STUB_TASK_MS ?? 1500));
  }
  const codingScript = process.env.JEEVES_FAKE_CODING_SCRIPT;
  return createAgentExecutor({
    agents: codingScript
      ? fakeCodingAgents(codingScript)
      : codingAgents(settings, process.env.JEEVES_CODEX_PATH, process.env.JEEVES_OPENCODE_PATH),
    checks: process.env.JEEVES_FAKE_CHECKS
      ? markerChecks(Number(process.env.JEEVES_FAKE_CHECKS) || 0)
      : projectChecks(),
  });
}

const shutdown = async () => {
  // Stop live planning/task work first, so aborted agents and their process groups die before the
  // job queue and database close. Recover on the next start restores interrupted attempts.
  await app.runs.stopAll();
  await app.close();
  await jobs.stop();
  await db.close();
  process.exit(0);
};
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

await app.listen({ host: config.host, port: config.port });
await requeuePlanning(db.db, jobs);

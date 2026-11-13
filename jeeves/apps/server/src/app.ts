import { spawn } from "node:child_process";
import Fastify, { type FastifyInstance, type FastifyServerOptions } from "fastify";
import {
  hasZodFastifySchemaValidationErrors,
  serializerCompiler,
  validatorCompiler,
} from "fastify-type-provider-zod";
import { providerModels } from "./chat/models.ts";
import { ChatService, type ModelSource } from "./chat/service.ts";
import { type CodexLogin, createCodexLogin } from "./codex-login.ts";
import type { Db } from "./db/client.ts";
import { DesignService } from "./design/service.ts";
import { createModelCatalog, type ModelCatalog } from "./model-catalog.ts";
import { chatRoutes } from "./routes/chat.ts";
import { generationRoutes } from "./routes/generation.ts";
import { modelRoutes } from "./routes/models.ts";
import { projectRoutes } from "./routes/projects.ts";
import { settingsRoutes } from "./routes/settings.ts";
import { jeevesHome, Settings } from "./settings.ts";

export type HealthResponse = {
  status: "ok" | "degraded";
  database: "ok" | "unreachable";
  version: string;
};

export type AppDeps = {
  db: Db;
  pingDb: () => Promise<void>;
  version: string;
  settings?: Settings;
  /** Providers for chat. Defaults to the real ones from `settings`. */
  models?: ModelSource;
  /** Settings' Sign in with ChatGPT. Defaults to running `codex` from the PATH. */
  codexLogin?: CodexLogin;
  /**
   * The chat's model picker: models.dev's catalogue, kept in `JEEVES_HOME`. Defaults to fetching
   * it, unless the server replays a scripted model (`JEEVES_FAKE_MODEL_SCRIPT`).
   */
  modelCatalog?: ModelCatalog;
  /** `true` in the server; tests may pass options with a `stream` to read the log lines. */
  logger?: FastifyServerOptions["logger"];
};

/** Builds the API without listening, so tests can use `app.inject`. */
export function buildApp({
  db,
  pingDb,
  version,
  settings = new Settings(jeevesHome()),
  models = providerModels(settings),
  codexLogin = createCodexLogin({ spawn, env: process.env }),
  modelCatalog = createModelCatalog({
    home: jeevesHome(),
    fetch: process.env.JEEVES_FAKE_MODEL_SCRIPT ? null : fetch,
    now: Date.now,
  }),
  logger = false,
}: AppDeps): FastifyInstance {
  const app = Fastify({ logger });
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  app.setErrorHandler((err, _req, reply) => {
    if (hasZodFastifySchemaValidationErrors(err)) {
      return reply.code(400).send({
        code: "BAD_REQUEST",
        message: err.message,
        issues: err.validation.map((v) => ({ path: v.instancePath, message: v.message })),
      });
    }
    return reply.send(err);
  });

  app.get("/health", async (_req, reply) => {
    let database: HealthResponse["database"] = "ok";
    try {
      await pingDb();
    } catch (err) {
      app.log.warn({ err }, "database ping failed");
      database = "unreachable";
    }
    const body: HealthResponse = {
      status: database === "ok" ? "ok" : "degraded",
      database,
      version,
    };
    return reply.code(database === "ok" ? 200 : 503).send(body);
  });

  const design = new DesignService(db);
  const chat = new ChatService(db, design, models);
  app.register(projectRoutes, { service: design });
  app.register(generationRoutes, { service: design });
  app.register(chatRoutes, { chat });
  app.register(settingsRoutes, { settings, codexLogin });
  app.register(modelRoutes, { settings, catalog: modelCatalog });
  // A login still waiting for the browser doesn't outlive the server.
  app.addHook("onClose", async () => codexLogin.stop());

  return app;
}

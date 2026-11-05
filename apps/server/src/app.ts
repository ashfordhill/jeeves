import { dirname } from "node:path";
import Fastify, { type FastifyInstance } from "fastify";
import {
  hasZodFastifySchemaValidationErrors,
  serializerCompiler,
  validatorCompiler,
} from "fastify-type-provider-zod";
import { ArchitectureLibrary } from "./architecture/library.ts";
import { providerModels } from "./chat/models.ts";
import { ChatService, type ModelSource } from "./chat/service.ts";
import type { Db } from "./db/client.ts";
import { DesignService } from "./design/service.ts";
import { architectureLibraryRoutes } from "./routes/architecture-library.ts";
import { chatRoutes } from "./routes/chat.ts";
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
  logger?: boolean;
};

/** Builds the API without listening, so tests can use `app.inject`. */
export function buildApp({
  db,
  pingDb,
  version,
  settings = new Settings(jeevesHome()),
  models = providerModels(settings),
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
  const library = new ArchitectureLibrary(dirname(settings.configPath));
  const chat = new ChatService(db, design, models, library);
  app.register(architectureLibraryRoutes, { library, design });
  app.register(projectRoutes, { service: design });
  app.register(chatRoutes, { chat });
  app.register(settingsRoutes, { settings });

  return app;
}

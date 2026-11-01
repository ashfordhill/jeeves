import { dirname } from "node:path";
import { stubExecutor, type TaskExecutor } from "@jeeves/orchestrator";
import { builtinRegistry, type Registry } from "@jeeves/registry";
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
import { GenerationService, type GeneratorRunner } from "./generate/service.ts";
import { architectureLibraryRoutes } from "./routes/architecture-library.ts";
import { chatRoutes } from "./routes/chat.ts";
import { generateRoutes } from "./routes/generate.ts";
import { projectRoutes } from "./routes/projects.ts";
import { runRoutes } from "./routes/runs.ts";
import { settingsRoutes } from "./routes/settings.ts";
import { templateRoutes } from "./routes/templates.ts";
import { type JobQueue, localJobs } from "./runs/jobs.ts";
import { RunService } from "./runs/service.ts";
import { jeevesHome, Settings } from "./settings.ts";

export type HealthResponse = {
  status: "ok" | "degraded";
  database: "ok" | "unreachable";
  version: string;
};

declare module "fastify" {
  interface FastifyInstance {
    /** The run service, exposed so server shutdown can abort live work. */
    runs: RunService;
  }
}

export type AppDeps = {
  db: Db;
  pingDb: () => Promise<void>;
  version: string;
  registry?: Registry;
  settings?: Settings;
  /** Providers for chat (and later the planner). Defaults to the real ones from `settings`. */
  models?: ModelSource;
  /** Writes projects and runs the baseline; tests pass a fake so they need no Docker. */
  generator?: GeneratorRunner;
  /** Parent folder for default output folders (`JEEVES_PROJECTS_DIR`, else ~/jeeves-projects). */
  projectsDir?: string;
  /** Background jobs for runs: pg-boss in the app, an in-process queue by default (tests). */
  jobs?: JobQueue;
  /** Runs each task attempt: the coding-agent executor in the app; a stub by default (tests). */
  executor?: TaskExecutor;
  logger?: boolean;
};

/** Builds the API without listening, so tests can use `app.inject`. */
export function buildApp({
  db,
  pingDb,
  version,
  registry = builtinRegistry(),
  settings = new Settings(jeevesHome()),
  models = providerModels(settings),
  generator,
  projectsDir,
  jobs = localJobs(),
  executor = stubExecutor(),
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

  const design = new DesignService(db, registry);
  const library = new ArchitectureLibrary(dirname(settings.configPath));
  const chat = new ChatService(db, design, registry, models, library);
  app.register(architectureLibraryRoutes, { library, design, registry });

  const generation = new GenerationService(db, design, generator, projectsDir);
  const runs = new RunService(db, design, models, registry, jobs, executor);
  app.decorate("runs", runs);
  app.addHook("onReady", () => runs.init());

  app.register(projectRoutes, { service: design });
  app.register(generateRoutes, { generation });
  app.register(templateRoutes, { registry });
  app.register(chatRoutes, { chat });
  app.register(runRoutes, { runs });
  app.register(settingsRoutes, { settings });

  return app;
}

import { builtinRegistry, type Registry } from "@jeeves/registry";
import Fastify, { type FastifyInstance } from "fastify";
import {
  hasZodFastifySchemaValidationErrors,
  serializerCompiler,
  validatorCompiler,
} from "fastify-type-provider-zod";
import type { Db } from "./db/client.ts";
import { DesignService } from "./design/service.ts";
import { projectRoutes } from "./routes/projects.ts";
import { templateRoutes } from "./routes/templates.ts";

export type HealthResponse = {
  status: "ok" | "degraded";
  database: "ok" | "unreachable";
  version: string;
};

export type AppDeps = {
  db: Db;
  pingDb: () => Promise<void>;
  version: string;
  registry?: Registry;
  logger?: boolean;
};

/** Builds the API without listening, so tests can use `app.inject`. */
export function buildApp({
  db,
  pingDb,
  version,
  registry = builtinRegistry(),
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

  app.register(projectRoutes, { service: new DesignService(db, registry) });
  app.register(templateRoutes, { registry });

  return app;
}

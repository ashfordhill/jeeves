import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { knownHosts, type ModelCatalog, modelsView } from "../model-catalog.ts";
import type { Settings } from "../settings.ts";

/**
 * The chat's model picker (`GET /models`: the design chat's model and each provider's models,
 * whether it is ready and its status) and the custom endpoint's known hosts (`GET /models/hosts`).
 * A pick is saved through `PUT /settings/roles`.
 */
export const modelRoutes: FastifyPluginAsyncZod<{
  settings: Settings;
  catalog: ModelCatalog;
}> = async (app, { settings, catalog }) => {
  app.get("/models", async () => modelsView(settings, catalog));
  app.get("/models/hosts", async () => ({ hosts: knownHosts(await catalog.providers()) }));
};

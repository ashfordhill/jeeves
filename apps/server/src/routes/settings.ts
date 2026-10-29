import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { modelsPatchSchema, type Settings } from "../settings.ts";

/** Provider key status (never the keys) and models per role. */
export const settingsRoutes: FastifyPluginAsyncZod<{ settings: Settings }> = async (
  app,
  { settings },
) => {
  app.get("/settings", async () => settings.view());

  app.put("/settings/models", { schema: { body: modelsPatchSchema } }, async (req) => {
    settings.setModels(req.body);
    return settings.view();
  });
};

import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { rolesPatchSchema, type Settings, SettingsError } from "../settings.ts";

/** Provider status (never the keys) and the provider and model per role. */
export const settingsRoutes: FastifyPluginAsyncZod<{ settings: Settings }> = async (
  app,
  { settings },
) => {
  app.get("/settings", async () => settings.view());

  app.put("/settings/roles", { schema: { body: rolesPatchSchema } }, async (req, reply) => {
    try {
      settings.setRoles(req.body);
    } catch (err) {
      if (err instanceof SettingsError) {
        return reply.code(422).send({ code: "INVALID_ROLE_MODEL", message: err.message });
      }
      throw err;
    }
    return settings.view();
  });
};

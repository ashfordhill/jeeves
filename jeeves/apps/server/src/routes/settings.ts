import { providerInfo } from "@jeeves/providers";
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { z } from "zod";
import type { CodexLogin } from "../codex-login.ts";
import {
  isKeyProvider,
  type KeyProviderId,
  rolesPatchSchema,
  type Settings,
  SettingsError,
} from "../settings.ts";

const providerParams = z.object({ id: z.string() });
const keyBody = z.strictObject({ key: z.string().trim().min(8).max(400) });

type Refusal = { status: 404 | 422; code: string; message: string };

/** The provider whose key a request names, or why it has none. */
function keyProvider(id: string): { id: KeyProviderId } | Refusal {
  const info = providerInfo(id);
  if (!info) return { status: 404, code: "NOT_FOUND", message: `Provider "${id}" not found.` };
  if (!isKeyProvider(info.id)) {
    return { status: 422, code: "KEY_NOT_SUPPORTED", message: `${info.name} doesn't take a key.` };
  }
  return { id: info.id };
}

/**
 * Provider status (never the keys), a provider's saved key, Codex's sign-in, and the provider and
 * model per role. A key goes in and never comes back out: every answer is `settings.view()`, or a
 * Codex login's state.
 */
export const settingsRoutes: FastifyPluginAsyncZod<{
  settings: Settings;
  codexLogin: CodexLogin;
}> = async (app, { settings, codexLogin }) => {
  app.get("/settings", async () => settings.view());

  app.put(
    "/settings/providers/:id/key",
    { schema: { params: providerParams, body: keyBody } },
    async (req, reply) => {
      const provider = keyProvider(req.params.id);
      if ("status" in provider) {
        return reply.code(provider.status).send({ code: provider.code, message: provider.message });
      }
      settings.setKey(provider.id, req.body.key);
      return settings.view();
    },
  );

  app.delete(
    "/settings/providers/:id/key",
    { schema: { params: providerParams } },
    async (req, reply) => {
      const provider = keyProvider(req.params.id);
      if ("status" in provider) {
        return reply.code(provider.status).send({ code: provider.code, message: provider.message });
      }
      settings.removeKey(provider.id);
      return settings.view();
    },
  );

  // Sign in with ChatGPT: `codex login`, whose sign-in page the person finishes in a browser.
  app.post("/settings/codex/login", async () => codexLogin.start());
  app.get("/settings/codex/login", async () => codexLogin.state());

  app.post("/settings/codex/logout", async (_req, reply) => {
    try {
      await codexLogin.signOut();
    } catch (err) {
      return reply
        .code(502)
        .send({ code: "CODEX_LOGOUT_FAILED", message: err instanceof Error ? err.message : "" });
    }
    return settings.view();
  });

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

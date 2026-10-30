import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { z } from "zod";
import { acceptancePacks } from "../generate/acceptance-packs.ts";
import type { GenerationService } from "../generate/service.ts";
import { notFound } from "./projects.ts";

const projectParams = z.object({ id: z.uuid() });
const generationParams = z.object({
  id: z.uuid(),
  generationId: z.coerce.number().int().positive(),
});
const startBody = z.strictObject({
  outputDir: z.string().trim().max(1000).optional(),
  baseline: z.boolean().default(true),
  acceptancePack: z.string().trim().max(100).optional(),
});

/**
 * Generate (PLAN §9).
 *
 * - `GET /projects/:id/generation`: the output folder, a suggested default, and the latest run
 * - `POST /projects/:id/generations`: starts one (202); 409 `GENERATE_BUSY`, 422
 *   `DESIGN_NOT_READY` or `INVALID_OUTPUT_DIR`
 * - `GET /projects/:id/generations/:generationId/events`: newline-delimited JSON
 *   (`GenerationEvent`s): a `snapshot`, then `step`, `log` and `check` events, then `done`
 * - `POST /projects/:id/generations/:generationId/cancel`
 */
export const generateRoutes: FastifyPluginAsyncZod<{ generation: GenerationService }> = async (
  app,
  { generation },
) => {
  app.get("/projects/:id/generation", { schema: { params: projectParams } }, async (req, reply) => {
    const overview = await generation.overview(req.params.id);
    return overview ?? notFound(reply);
  });

  app.get("/generate/acceptance-packs", async () => acceptancePacks());

  app.post(
    "/projects/:id/generations",
    { schema: { params: projectParams, body: startBody } },
    async (req, reply) => {
      const started = await generation.start(req.params.id, req.body);
      if (!started.ok) {
        return reply.code(started.status).send({ code: started.code, message: started.message });
      }
      return reply.code(202).send({ generation: started.generation });
    },
  );

  app.get(
    "/projects/:id/generations/:generationId",
    { schema: { params: generationParams } },
    async (req, reply) => {
      const found = await generation.get(req.params.id, req.params.generationId);
      return found ? { generation: found } : notFound(reply, "Generation");
    },
  );

  app.get(
    "/projects/:id/generations/:generationId/events",
    { schema: { params: generationParams } },
    async (req, reply) => {
      const found = await generation.get(req.params.id, req.params.generationId);
      if (!found) return notFound(reply, "Generation");
      reply.hijack();
      reply.raw.writeHead(200, {
        "content-type": "application/x-ndjson; charset=utf-8",
        "cache-control": "no-cache",
      });
      await generation.follow(req.params.id, req.params.generationId, (event) => {
        if (!reply.raw.destroyed) reply.raw.write(`${JSON.stringify(event)}\n`);
      });
      reply.raw.end();
    },
  );

  app.post(
    "/projects/:id/generations/:generationId/cancel",
    { schema: { params: generationParams } },
    async (req, reply) =>
      generation.cancel(req.params.id, req.params.generationId)
        ? reply.code(202).send({ cancelling: true })
        : reply.code(409).send({ code: "NOT_RUNNING", message: "That generation isn't running." }),
  );
};

import type { Registry } from "@jeeves/registry";
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { z } from "zod";
import { notFound } from "./projects.ts";

/** The template registry: every version described, plus the palette grouping for the canvas. */
export const templateRoutes: FastifyPluginAsyncZod<{ registry: Registry }> = async (
  app,
  { registry },
) => {
  app.get("/templates", async () => ({
    templates: registry.list().map((manifest) => registry.describe(manifest)),
    palette: registry.palette().map(({ group, templates }) => ({
      group,
      templates: templates.map(({ id, version }) => ({ id, version })),
    })),
  }));

  app.get(
    "/templates/:id",
    { schema: { params: z.object({ id: z.string() }) } },
    async (req, reply) => {
      const latest = registry.latest(req.params.id);
      return latest ? { template: registry.describe(latest) } : notFound(reply, "Template");
    },
  );

  app.get(
    "/templates/:id/:version",
    { schema: { params: z.object({ id: z.string(), version: z.string() }) } },
    async (req, reply) => {
      const template = registry.describe(req.params);
      return template ? { template } : notFound(reply, "Template");
    },
  );
};

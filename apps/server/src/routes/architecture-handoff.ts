import type { Registry } from "@jeeves/registry";
import { buildArchitectureHandoff } from "@jeeves/spec";
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { z } from "zod";
import type { ArchitectureLibrary } from "../architecture/library.ts";
import type { DesignService } from "../design/service.ts";

/** Read-only export: no filesystem/source application inspection, generation or task creation. */
export const architectureHandoffRoutes: FastifyPluginAsyncZod<{
  design: DesignService;
  registry: Registry;
  library: ArchitectureLibrary;
}> = async (app, { design, registry, library }) => {
  app.get(
    "/projects/:id/architecture-handoff",
    {
      schema: {
        params: z.strictObject({ id: z.uuid() }),
        querystring: z.strictObject({ baseRevision: z.coerce.number().int().nonnegative() }),
      },
    },
    async (req, reply) => {
      reply.header("Cache-Control", "no-store");
      const project = await design.getProject(req.params.id);
      const state = await design.getDesign(req.params.id);
      if (!project || !state) return reply.code(404).send({ message: "Project not found." });
      const architecture = await design.architecture(project.id);
      if (
        !architecture ||
        state.design.revision !== req.query.baseRevision ||
        architecture.revision !== state.design.revision ||
        project.revision !== state.design.revision
      )
        return reply.code(409).send({
          code: "REVISION_CONFLICT",
          message: "The design changed. Reload before capturing a review snapshot.",
        });
      // Unavailable local definitions stay explicit. Catalog corruption must not invent a definition.
      let entries: ReturnType<ArchitectureLibrary["list"]> = [];
      try {
        entries = library.list("", true);
      } catch {
        /* Export remains useful with unavailable manifests. */
      }
      const snapshot = await buildArchitectureHandoff({
        design: state.design,
        project,
        lookup: registry,
        evidence: architecture.evidence,
        provision: architecture.views.provision,
        library: entries,
        ...(project.target && {
          origin: {
            sourceProjectId: project.target.sourceProjectId,
            sourceRevision: project.target.sourceRevision,
            recipeMode: project.target.recipeMode,
          },
        }),
      });
      const current = await design.getProject(project.id);
      if (current?.revision !== state.design.revision || current.name !== project.name)
        return reply.code(409).send({
          code: "REVISION_CONFLICT",
          message: "The design changed during capture. Reload before exporting.",
        });
      return { snapshot };
    },
  );
};

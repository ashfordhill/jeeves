import type { Registry } from "@jeeves/registry";
import {
  architectureSelectionSchema,
  extractArchitectureTemplate,
  idSchema,
  libraryInsertSchema,
  libraryMetadataSchema,
  previewArchitectureTemplate,
  versionSchema,
} from "@jeeves/spec";
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { z } from "zod";
import { type ArchitectureLibrary, LibraryError } from "../architecture/library.ts";
import type { DesignService } from "../design/service.ts";

const params = z.strictObject({ id: idSchema, version: versionSchema });
export const architectureLibraryRoutes: FastifyPluginAsyncZod<{
  library: ArchitectureLibrary;
  design: DesignService;
  registry: Registry;
}> = async (app, { library, design, registry }) => {
  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof LibraryError)
      return reply.code(error.status).send({ message: error.message });
    if (error instanceof z.ZodError)
      return reply.code(422).send({ message: z.prettifyError(error) });
    return reply.send(error);
  });
  app.get(
    "/architecture-library",
    {
      schema: {
        querystring: z.strictObject({
          query: z.string().max(200).optional(),
          all: z.enum(["true", "false"]).optional(),
        }),
      },
    },
    async (req) => ({ entries: library.list(req.query.query, req.query.all === "true") }),
  );
  app.get("/architecture-library/:id/:version", { schema: { params } }, async (req) => ({
    entry: library.get(req.params.id, req.params.version),
  }));
  app.post(
    "/architecture-library",
    {
      schema: {
        body: z.strictObject({
          id: idSchema,
          version: versionSchema,
          name: z.string().trim().min(1).max(120),
          purpose: z.string().trim().min(1).max(1200),
          projectId: z.uuid(),
          baseRevision: z.int().nonnegative(),
          selection: architectureSelectionSchema,
        }),
      },
    },
    async (req, reply) => {
      const current = await design.getDesign(req.body.projectId);
      if (!current) throw new LibraryError("Source project not found.", 404);
      if (current.design.revision !== req.body.baseRevision)
        throw new LibraryError("The source design changed. Reopen the selection before saving.");
      try {
        const extracted = extractArchitectureTemplate(
          current.design,
          req.body.selection,
          req.body,
          registry,
        );
        return reply
          .code(201)
          .send({ entry: library.create(extracted.fragment, extracted.metadata) });
      } catch (error) {
        if (error instanceof LibraryError) throw error;
        throw new LibraryError((error as Error).message, 422);
      }
    },
  );
  app.post(
    "/architecture-library/:id/:version/clone",
    { schema: { params, body: z.strictObject({ version: versionSchema }) } },
    async (req, reply) =>
      reply
        .code(201)
        .send({ entry: library.clone(req.params.id, req.params.version, req.body.version) }),
  );
  app.post(
    "/architecture-library/:id/:version/change",
    {
      schema: {
        params,
        body: z.strictObject({
          draftRevision: z.int().nonnegative(),
          action: z.enum(["edit", "publish", "retire", "delete"]),
          metadata: libraryMetadataSchema.optional(),
        }),
      },
    },
    async (req) => ({
      entry: library.change(
        req.params.id,
        req.params.version,
        req.body.draftRevision,
        req.body.action,
        req.body.metadata,
      ),
    }),
  );
  app.post(
    "/projects/:projectId/architecture-library/preview",
    { schema: { params: z.strictObject({ projectId: z.uuid() }), body: libraryInsertSchema } },
    async (req) => {
      const current = await design.getDesign(req.params.projectId);
      if (!current) throw new LibraryError("Project not found.", 404);
      try {
        return previewArchitectureTemplate(
          current.design,
          library.get(req.body.id, req.body.version),
          req.body,
          registry,
        );
      } catch (error) {
        if (error instanceof LibraryError || error instanceof z.ZodError) throw error;
        throw new LibraryError((error as Error).message, 422);
      }
    },
  );
};

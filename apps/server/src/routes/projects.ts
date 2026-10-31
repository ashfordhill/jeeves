import { createRecipeDesign, RecipeError, recipeCatalog } from "@jeeves/generator";
import { freePort } from "@jeeves/generator/baseline";
import { layoutSchema, operationBatchSchema, templateRefSchema } from "@jeeves/spec";
import type { FastifyReply } from "fastify";
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { z } from "zod";
import { operationSources } from "../db/schema.ts";
import type { ChangeResult, DesignService } from "../design/service.ts";

const projectParams = z.object({ id: z.uuid() });
const projectBody = z.strictObject({ name: z.string().trim().min(1).max(120) });
const projectPatch = z.strictObject({
  name: z.string().trim().min(1).max(120).optional(),
  outputDir: z.string().trim().min(1).max(1000).optional(),
});
const source = z.enum(operationSources).default("api");

/**
 * `ops` is left loose here so `applyOperations` can report malformed ops as `INVALID_OPERATION`
 * findings with their index, instead of a generic 400.
 */
const editBody = operationBatchSchema.extend({
  ops: z.array(z.unknown()).min(1).max(500),
  source,
});
const restoreBody = z.strictObject({ baseRevision: z.int().nonnegative(), source });

export const notFound = (reply: FastifyReply, what = "Project") =>
  reply.code(404).send({ code: "NOT_FOUND", message: `${what} not found.` });

/** Project CRUD, the design with its history and findings, operations, undo/redo, and layout. */
export const projectRoutes: FastifyPluginAsyncZod<{ service: DesignService }> = async (
  app,
  { service },
) => {
  app.get("/projects", async () => ({ projects: await service.listProjects() }));
  app.get("/recipes", async () => ({ recipes: recipeCatalog() }));
  app.post(
    "/projects/from-recipe",
    {
      schema: {
        body: z.strictObject({
          name: z.string().trim().min(1).max(80),
          recipe: templateRefSchema,
          config: z.record(z.string(), z.unknown()).optional(),
        }),
      },
    },
    async (req, reply) => {
      try {
        const initial = createRecipeDesign(req.body.recipe, {
          title: req.body.name,
          hostPort: await freePort(),
          config: req.body.config,
        });
        const project = await service.createProject(req.body.name, initial);
        return reply.code(201).send({ project });
      } catch (error) {
        if (error instanceof RecipeError || error instanceof z.ZodError)
          return reply.code(422).send({ code: "INVALID_RECIPE", message: error.message });
        throw error;
      }
    },
  );

  app.post("/projects", { schema: { body: projectBody } }, async (req, reply) => {
    const project = await service.createProject(req.body.name);
    return reply.code(201).send({ project });
  });

  app.get("/projects/:id", { schema: { params: projectParams } }, async (req, reply) => {
    const project = await service.getProject(req.params.id);
    return project ? { project } : notFound(reply);
  });

  app.patch(
    "/projects/:id",
    { schema: { params: projectParams, body: projectPatch } },
    async (req, reply) => {
      const project = await service.updateProject(req.params.id, req.body);
      return project ? { project } : notFound(reply);
    },
  );

  app.delete("/projects/:id", { schema: { params: projectParams } }, async (req, reply) => {
    return (await service.deleteProject(req.params.id)) ? reply.code(204).send() : notFound(reply);
  });

  app.get("/projects/:id/design", { schema: { params: projectParams } }, async (req, reply) => {
    const state = await service.getDesign(req.params.id);
    return state ?? notFound(reply);
  });

  app.get("/projects/:id/findings", { schema: { params: projectParams } }, async (req, reply) => {
    const state = await service.getDesign(req.params.id);
    return state ? { revision: state.design.revision, findings: state.findings } : notFound(reply);
  });

  app.post(
    "/projects/:id/operations",
    { schema: { params: projectParams, body: editBody } },
    async (req, reply) => sendChange(reply, await service.edit(req.params.id, req.body)),
  );

  app.post(
    "/projects/:id/undo",
    { schema: { params: projectParams, body: restoreBody } },
    async (req, reply) =>
      sendChange(reply, await service.undo(req.params.id, req.body.baseRevision, req.body.source)),
  );

  app.post(
    "/projects/:id/redo",
    { schema: { params: projectParams, body: restoreBody } },
    async (req, reply) =>
      sendChange(reply, await service.redo(req.params.id, req.body.baseRevision, req.body.source)),
  );

  app.get("/projects/:id/layout", { schema: { params: projectParams } }, async (req, reply) => {
    const layout = await service.getLayout(req.params.id);
    return layout ? { layout } : notFound(reply);
  });

  app.put(
    "/projects/:id/layout",
    { schema: { params: projectParams, body: layoutSchema } },
    async (req, reply) => {
      return (await service.putLayout(req.params.id, req.body))
        ? { layout: req.body }
        : notFound(reply);
    },
  );
};

/**
 * - 200: the new design state and the history row's `operationId`
 * - 409 `REVISION_CONFLICT`: the current design state, so the client can rebase or reload
 * - 422 `INVALID_OPERATION`: the batch changed nothing; `errors` holds the findings
 * - 422 `NOTHING_TO_UNDO` / `NOTHING_TO_REDO`
 */
function sendChange(reply: FastifyReply, result: ChangeResult) {
  if (result.ok) return reply.send({ ...result.state, operationId: result.operationId });
  switch (result.reason) {
    case "not-found":
      return notFound(reply);
    case "conflict":
      return reply
        .code(409)
        .send({ code: "REVISION_CONFLICT", message: result.message, ...result.state });
    case "invalid":
      return reply.code(422).send({
        code: "INVALID_OPERATION",
        message: result.errors.map((e) => e.message).join(" "),
        errors: result.errors,
      });
    case "nothing-to-undo":
    case "nothing-to-redo":
      return reply.code(422).send({
        code: result.reason === "nothing-to-undo" ? "NOTHING_TO_UNDO" : "NOTHING_TO_REDO",
        message: result.message,
      });
  }
}

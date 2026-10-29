import { gitStrategies, plannedTaskEditSchema } from "@jeeves/orchestrator";
import type { FastifyReply } from "fastify";
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { z } from "zod";
import type { Failure, RunService } from "../runs/service.ts";
import { notFound } from "./projects.ts";

const projectParams = z.object({ id: z.uuid() });
const runParams = projectParams.extend({ runId: z.coerce.number().int().positive() });
const taskParams = runParams.extend({ taskId: z.coerce.number().int().positive() });
const actionParams = runParams.extend({
  action: z.enum(["start", "pause", "resume", "cancel", "replan"]),
});
const taskPatch = plannedTaskEditSchema
  .partial()
  .strict()
  .refine((patch) => Object.keys(patch).length > 0, "Nothing to change.");
const orderBody = z.strictObject({ taskIds: z.array(z.int().positive()).max(500) });
const attemptParams = runParams.extend({ attemptId: z.coerce.number().int().positive() });
const settingsBody = z
  .strictObject({
    gitStrategy: z.enum(gitStrategies),
    maxRetries: z.int().min(0).max(5),
  })
  .partial()
  .refine((patch) => Object.keys(patch).length > 0, "Nothing to change.");

const fail = (reply: FastifyReply, failure: Failure) =>
  reply.code(failure.status).send({ code: failure.code, message: failure.message });

/**
 * Runs (PLAN §10).
 *
 * - `GET /projects/:id/runs`: the runs, newest first, and whether the project can be planned
 * - `POST /projects/:id/runs`: plan a new run (202; planning continues in the background);
 *   422 `PROJECT_NOT_GENERATED`, 409 `RUN_ACTIVE`
 * - `GET /projects/:id/runs/:runId`: the run, its tasks with attempts, allowed actions, usage
 * - `PATCH|DELETE /projects/:id/runs/:runId/tasks/:taskId`: edit or remove a pending task
 * - `PUT /projects/:id/runs/:runId/order`: reorder the pending tasks
 * - `POST /projects/:id/runs/:runId/{start,pause,resume,cancel,replan}`; 409 `RUN_STATE`
 * - `GET /projects/:id/runs/:runId/attempts/:attemptId`: one attempt with its live log, checks,
 *   changed files, and diff
 * - `GET|PUT /projects/:id/run-settings`: the git strategy and retry limit for new runs
 */
export const runRoutes: FastifyPluginAsyncZod<{ runs: RunService }> = async (app, { runs }) => {
  app.get("/projects/:id/runs", { schema: { params: projectParams } }, async (req, reply) => {
    const readiness = await runs.readiness(req.params.id);
    if (!readiness) return notFound(reply);
    return { runs: await runs.list(req.params.id), readiness };
  });

  app.post("/projects/:id/runs", { schema: { params: projectParams } }, async (req, reply) => {
    const created = await runs.create(req.params.id);
    return created.ok ? reply.code(202).send({ run: created.run }) : fail(reply, created);
  });

  app.get("/projects/:id/runs/:runId", { schema: { params: runParams } }, async (req, reply) => {
    const detail = await runs.get(req.params.id, req.params.runId);
    return detail ?? notFound(reply, "Run");
  });

  app.patch(
    "/projects/:id/runs/:runId/tasks/:taskId",
    { schema: { params: taskParams, body: taskPatch } },
    async (req, reply) => {
      const { id, runId, taskId } = req.params;
      const edited = await runs.editTask(id, runId, taskId, req.body);
      return edited.ok ? { task: edited.task } : fail(reply, edited);
    },
  );

  app.delete(
    "/projects/:id/runs/:runId/tasks/:taskId",
    { schema: { params: taskParams } },
    async (req, reply) => {
      const { id, runId, taskId } = req.params;
      const removed = await runs.removeTask(id, runId, taskId);
      return removed.ok ? reply.code(204).send() : fail(reply, removed);
    },
  );

  app.put(
    "/projects/:id/runs/:runId/order",
    { schema: { params: runParams, body: orderBody } },
    async (req, reply) => {
      const reordered = await runs.reorder(req.params.id, req.params.runId, req.body.taskIds);
      return reordered.ok ? reply.code(204).send() : fail(reply, reordered);
    },
  );

  app.get(
    "/projects/:id/runs/:runId/attempts/:attemptId",
    { schema: { params: attemptParams } },
    async (req, reply) => {
      const { id, runId, attemptId } = req.params;
      const attempt = await runs.attemptDetail(id, runId, attemptId);
      return attempt ? { attempt } : notFound(reply, "Attempt");
    },
  );

  app.get(
    "/projects/:id/run-settings",
    { schema: { params: projectParams } },
    async (req, reply) => {
      const settings = await runs.settings(req.params.id);
      return settings ?? notFound(reply);
    },
  );

  app.put(
    "/projects/:id/run-settings",
    { schema: { params: projectParams, body: settingsBody } },
    async (req, reply) => {
      const settings = await runs.saveSettings(req.params.id, req.body);
      return settings ?? notFound(reply);
    },
  );

  app.post(
    "/projects/:id/runs/:runId/:action",
    { schema: { params: actionParams } },
    async (req, reply) => {
      const { id, runId, action } = req.params;
      const result = await runs.act(id, runId, action);
      return result.ok ? { run: result.run } : fail(reply, result);
    },
  );
};

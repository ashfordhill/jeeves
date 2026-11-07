import type { FastifyPluginAsyncZod, ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import { acceptedTypes, MAX_FILE_BYTES, mediaTypeFor } from "../chat/files.ts";
import type { ChatService } from "../chat/service.ts";
import { notFound } from "./projects.ts";

const projectParams = z.object({ id: z.uuid() });
const fileParams = z.object({ id: z.uuid(), fileId: z.uuid() });
const chatBody = z.strictObject({
  baseRevision: z.int().nonnegative(),
  message: z.string().trim().min(1).max(20_000),
  fileIds: z.array(z.uuid()).max(10).default([]),
  selection: z.array(z.string().max(63)).max(200).default([]),
});

/**
 * Chat turns and their files.
 *
 * `POST /projects/:id/chat` answers with newline-delimited JSON (`ChatEvent`s): `turn` first,
 * then `text` deltas and `activity` lines, then `done` with the turn and the design state
 * (`null` if the project was deleted during the turn). Errors
 * that prevent the turn from starting are ordinary JSON responses (404, 409 `CHAT_BUSY` or
 * `REVISION_CONFLICT`, 422 `UNKNOWN_FILE`).
 */
export const chatRoutes: FastifyPluginAsyncZod<{ chat: ChatService }> = async (app, { chat }) => {
  app.get("/projects/:id/chat", { schema: { params: projectParams } }, async (req) => ({
    turns: await chat.listTurns(req.params.id),
  }));

  app.post(
    "/projects/:id/chat",
    { schema: { params: projectParams, body: chatBody } },
    async (req, reply) => {
      const started = await chat.start(req.params.id, req.body);
      if (!started.ok) {
        return reply.code(started.status).send({ code: started.code, message: started.message });
      }
      reply.hijack();
      reply.raw.writeHead(200, {
        "content-type": "application/x-ndjson; charset=utf-8",
        "cache-control": "no-cache",
      });
      // The turn runs to the end even if the browser goes away; it's saved either way.
      await started.run((event) => {
        if (!reply.raw.destroyed) reply.raw.write(`${JSON.stringify(event)}\n`);
      });
      reply.raw.end();
    },
  );

  // Uploads send the raw bytes with the file's media type and an `x-file-name` header.
  app.register(async (scope) => {
    const uploads = scope.withTypeProvider<ZodTypeProvider>();
    uploads.addContentTypeParser(
      [...Object.keys(acceptedTypes), "application/octet-stream"],
      { parseAs: "buffer", bodyLimit: MAX_FILE_BYTES },
      (_req, body, done) => done(null, body),
    );

    uploads.post(
      "/projects/:id/files",
      { schema: { params: projectParams }, bodyLimit: MAX_FILE_BYTES },
      async (req, reply) => {
        const header = req.headers["x-file-name"];
        const name = decodeURIComponent(String(Array.isArray(header) ? header[0] : (header ?? "")))
          .trim()
          .slice(0, 200);
        if (!name) {
          return reply.code(400).send({ code: "BAD_REQUEST", message: "x-file-name is required." });
        }
        const mediaType = mediaTypeFor(name, req.headers["content-type"]);
        if (!mediaType || !Buffer.isBuffer(req.body)) {
          return reply.code(415).send({
            code: "UNSUPPORTED_FILE",
            message: "Attach Markdown, text, PNG, JPEG, WebP, or SVG files.",
          });
        }
        const saved = await chat.saveFile(req.params.id, { name, mediaType, data: req.body });
        if ("error" in saved) {
          return reply.code(422).send({ code: "INVALID_FILE", message: saved.error });
        }
        return reply.code(201).send({ file: saved });
      },
    );
  });

  app.get("/projects/:id/files/:fileId", { schema: { params: fileParams } }, async (req, reply) => {
    const file = await chat.getFile(req.params.id, req.params.fileId);
    if (!file) return notFound(reply, "File");
    return (
      reply
        .header("content-type", file.mediaType)
        .header("content-disposition", `inline; filename="${encodeURIComponent(file.name)}"`)
        // SVGs are shown as images only; never run their scripts in the app's origin.
        .header("content-security-policy", "default-src 'none'; style-src 'unsafe-inline'; sandbox")
        .send(file.data)
    );
  });
};

import {
  assembleExperimental,
  canonicalJson,
  GeneratorRefusal,
  loadYoutubeLocalInput,
  localV1Templates,
  sha256,
  youtubeLocalProfile,
} from "@jeeves/generator";
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { z } from "zod";
import type { DesignService } from "../design/service.ts";
import { scaffoldArchive } from "../generation/archive.ts";
import { installedGenerationSupport } from "../generation/support.ts";
import { notFound } from "./projects.ts";

const params = z.strictObject({ id: z.uuid() });
const hash = z.string().regex(/^[a-f0-9]{64}$/u);
const source = z.strictObject({
  profileId: z.string().min(1).max(80),
  baseRevision: z.int().nonnegative(),
  sourceSha256: hash,
});

/** No project writes, input code, arbitrary paths, remote assets, or strict readiness credit. */
export const generationRoutes: FastifyPluginAsyncZod<{ service: DesignService }> = async (
  app,
  { service },
) => {
  app.get("/generation-support", async (_req, reply) => {
    reply.header("Cache-Control", "no-store");
    return installedGenerationSupport();
  });
  for (const action of ["preview", "download"] as const) {
    app.post(
      `/projects/:id/experimental-generation/${action}`,
      {
        schema: {
          params,
          body: action === "download" ? source.extend({ archiveSha256: hash }) : source,
        },
      },
      async (req, reply) => {
        reply.header("Cache-Control", "no-store");
        const body = req.body;
        if (body.profileId !== youtubeLocalProfile.id)
          return reply.code(422).send({
            code: "UNSUPPORTED_PROFILE",
            message:
              "Only the reviewed youtube-local-v1 profile is installed. Select that frozen saved source; other profiles require review.",
          });
        const current = await service.getDesign(req.params.id);
        if (!current) return notFound(reply);
        const sourceHash = sha256(canonicalJson(current.design));
        if (body.baseRevision !== current.design.revision || body.sourceSha256 !== sourceHash)
          return reply.code(409).send({
            code: "SOURCE_CONFLICT",
            message:
              "The saved revision differs from this canvas. Reload the project, then preview again.",
          });
        if (sourceHash !== youtubeLocalProfile.sourceCanonicalSha256)
          return reply.code(422).send({
            code: "UNSUPPORTED_SOURCE",
            message:
              "This saved design does not match frozen YouTube local v1 snapshot005 (revision 3). Select the retained local v1 project or an exact saved-source copy. Changed designs need a reviewed profile; no older baseline was exported.",
          });
        try {
          const bundle = assembleExperimental(loadYoutubeLocalInput(), localV1Templates);
          const archive = scaffoldArchive(bundle.files);
          const archiveSha256 = sha256(archive);
          // Re-read after assembly: a concurrent edit/delete must not receive the old baseline.
          const latest = await service.getDesign(req.params.id);
          if (!latest || sha256(canonicalJson(latest.design)) !== sourceHash)
            return reply.code(409).send({
              code: "SOURCE_CONFLICT",
              message: "The saved source changed during generation. Reload and preview again.",
            });
          if ("archiveSha256" in body && body.archiveSha256 !== archiveSha256)
            return reply.code(409).send({
              code: "ARCHIVE_CONFLICT",
              message:
                "The installed export changed since preview. Preview again before downloading.",
            });
          const manifestFile = bundle.files.find((file) => file.path === ".jeeves/manifest.json");
          if (!manifestFile) throw new Error("Missing manifest");
          const manifestSha256 = sha256(manifestFile.bytes);
          if (action === "download") {
            reply.header("Content-Type", "application/zip");
            reply.header(
              "Content-Disposition",
              'attachment; filename="youtube-local-v1-experimental.zip"',
            );
            reply.header("X-Archive-Sha256", archiveSha256);
            reply.header("X-Manifest-Sha256", manifestSha256);
            reply.header("X-Source-Project", req.params.id);
            reply.header("X-Source-Revision", current.design.revision);
            reply.header("X-Source-Sha256", sourceHash);
            return reply.send(archive);
          }
          return {
            status: "experimental-partial",
            selectedSource: {
              projectId: req.params.id,
              revision: current.design.revision,
              canonicalSha256: sourceHash,
              matchesFrozenProfile: true,
            },
            profile: bundle.manifest.profile,
            generator: bundle.manifest.generator,
            archive: {
              filename: "youtube-local-v1-experimental.zip",
              format: "zip-store-v1",
              bytes: archive.length,
              sha256: archiveSha256,
              manifestSha256,
              files: bundle.files.length,
              payloadBytes: bundle.files.reduce((n, file) => n + file.bytes.length, 0),
            },
            templates: bundle.manifest.templates,
            settings: Object.fromEntries(
              ["emitted", "configuration-only", "custom", "unsupported", "unimplemented"].map(
                (status) => [
                  status,
                  bundle.report.settings.filter((setting) => setting.status === status).length,
                ],
              ),
            ),
            report: bundle.report,
          };
        } catch (error) {
          if (error instanceof GeneratorRefusal)
            return reply
              .code(422)
              .send({ code: error.code, path: error.path, message: error.message });
          app.log.error({ err: error }, "Experimental generation failed");
          return reply.code(503).send({
            code: "GENERATION_UNAVAILABLE",
            message:
              "The trusted experimental assets could not be assembled. Check the server installation and retry; no archive was exported.",
          });
        }
      },
    );
  }
};

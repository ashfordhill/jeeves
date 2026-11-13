// Application-owned Media fixture adapter, derived from PF14-reviewed v4.
import type { FastifyRequest } from "fastify";
import { HttpError } from "../../runtime/http.ts";
import type { VerifiedPrincipal } from "../../runtime/identity.ts";
import type { UploadFile, UploadHooks } from "../../runtime/owned-upload.ts";
import type { TileGuard } from "../../runtime/tile-guard.ts";
import {
  completionResponse,
  MAX_VIDEO_BYTES,
  newUpload,
  ORIGINALS_PREFIX,
  originalKey,
  requestedJob,
  videoMetadata,
} from "../video-lifecycle/video-lifecycle-lifecycle-writer.hooks.ts";

export function creatorChannel(principal: VerifiedPrincipal): string {
  const username =
    typeof principal.claims.preferred_username === "string"
      ? principal.claims.preferred_username.trim()
      : "";
  return (username || principal.subject).slice(0, 200);
}

export type UploadApiMultipartUploadsResources = {
  prefix: string;
  guard: TileGuard;
  lifecycle: Pick<UploadHooks<unknown, unknown>, "reserve" | "complete" | "closed">;
};

export function uploadApiMultipartUploadsHooks(resources: UploadApiMultipartUploadsResources) {
  // The lifecycle and the Transcoder find originals by the product's prefix: refuse to start if it moved.
  if (resources.prefix !== ORIGINALS_PREFIX)
    throw new Error(
      `Multipart's prefix ${resources.prefix} isn't ${ORIGINALS_PREFIX} (video-contract.ts)`,
    );
  const upload: UploadHooks<unknown, unknown> = {
    validate(input, principal) {
      const value = input as Record<string, unknown> | null;
      const size = value?.size;
      if (typeof size === "number" && (size > MAX_VIDEO_BYTES || size < 1))
        throw new HttpError(413, "FILE_SIZE", "Choose a file between 1 byte and 256 MiB.");
      if (
        value &&
        (value.contentType !== "video/mp4" ||
          typeof value.fileName !== "string" ||
          !/\.mp4$/i.test(value.fileName))
      )
        throw new HttpError(
          422,
          "UNSUPPORTED_FILE",
          "Choose an MP4 video (H.264/AAC, landscape 720p–1080p, 1–600 seconds).",
        );
      const parsed = newUpload.safeParse(input);
      if (!parsed.success)
        throw new HttpError(
          400,
          "INVALID_UPLOAD",
          "Check the file, title (1–200 characters) and description (up to 5000 characters).",
        );
      const { title, description, ...file } = parsed.data;
      return {
        file,
        metadata: videoMetadata.parse({ title, description, channel: creatorChannel(principal) }),
      };
    },
    metadata(input) {
      return videoMetadata.parse(input);
    },
    response(input) {
      return completionResponse.parse(input);
    },
    async reserve(tx, record) {
      return resources.lifecycle.reserve(tx, record);
    },
    async complete(tx, record, original) {
      return resources.lifecycle.complete(tx, record, original);
    },
    async closed(tx, record, terminal) {
      return resources.lifecycle.closed(tx, record, terminal);
    },
  };
  return {
    async principal(request: FastifyRequest): Promise<VerifiedPrincipal> {
      const principal = await resources.guard.require(request);
      creatorChannel(principal);
      return principal;
    },
    upload,
    originalKey(identity: { assetId: string; uploadId: string; file: UploadFile }): string {
      return originalKey(identity.assetId, identity.uploadId);
    },
    job(payload: unknown, eventId: string): unknown {
      return requestedJob(payload, eventId);
    },
  };
}

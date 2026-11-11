// Multipart uploads (Multipart uploads) in Upload API: the product hooks its multipart uploads template calls.
// Write them here. Export never overwrites your edits: export afresh and carry them over.
import type { FastifyRequest } from "fastify";
import type { VerifiedPrincipal } from "../../runtime/identity.ts";
import type { UploadFile, UploadHooks } from "../../runtime/owned-upload.ts";
import type { TileGuard } from "../../runtime/tile-guard.ts";
import { HttpError } from "../../runtime/http.ts";
import {
  MAX_VIDEO_BYTES,
  ORIGINALS_PREFIX,
  completionResponse,
  newUpload,
  originalKey,
  requestedJob,
  videoMetadata,
} from "../video-contract.ts";

/** YouTube's creator policy (v2's creatorIdentity): the realm role `creator`, which the account
 * script grants; the channel is the account's username. */
export function creatorChannel(principal: VerifiedPrincipal): string {
  const roles = (principal.claims.realm_access as { roles?: unknown } | undefined)?.roles;
  if (!Array.isArray(roles) || !roles.includes("creator"))
    throw new HttpError(403, "CREATOR_REQUIRED", "A creator account is required.");
  const username =
    typeof principal.claims.preferred_username === "string"
      ? principal.claims.preferred_username.trim()
      : "";
  return (username || principal.subject).slice(0, 200);
}

/** The template's generic resources: the key prefix it owns, the tile's sign-in and the lifecycle's upload hooks. */
export type UploadApiMultipartUploadsResources = {
  prefix: string;
  /** The tile's Auth guard, set to Required. */
  guard: TileGuard;
  /** The asset lifecycle (Lifecycle writer in Video lifecycle): it records each upload's asset. */
  lifecycle: Pick<UploadHooks<unknown, unknown>, "reserve" | "complete" | "closed">;
};

/** YouTube's upload hooks (V3-13): v1/v2's upload policy, with the lifecycle recording each video. */
export function uploadApiMultipartUploadsHooks(resources: UploadApiMultipartUploadsResources) {
  // The lifecycle and the Transcoder find originals by the product's prefix: refuse to start if it moved.
  if (resources.prefix !== ORIGINALS_PREFIX)
    throw new Error(`Multipart's prefix ${resources.prefix} isn't ${ORIGINALS_PREFIX} (video-contract.ts)`);
  const upload: UploadHooks<unknown, unknown> = {
    /** Checks a start request: its file and metadata (v1's bounds: 1 byte–256 MiB, MP4). */
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
    /** Parses stored metadata: a video's title, description and channel. */
    metadata(input) {
      return videoMetadata.parse(input);
    },
    /** Parses a stored completion response, which a repeated complete answers again. */
    response(input) {
      return completionResponse.parse(input);
    },
    /** Runs in the start transaction. The asset lifecycle answers it. */
    async reserve(tx, record) {
      return resources.lifecycle.reserve(tx, record);
    },
    /** Runs in the completion transaction: what completing answers. The asset lifecycle answers it. */
    async complete(tx, record, original) {
      return resources.lifecycle.complete(tx, record, original);
    },
    /** Runs when an upload is aborted, expires or fails. The asset lifecycle answers it. */
    async closed(tx, record, terminal) {
      return resources.lifecycle.closed(tx, record, terminal);
    },
  };
  return {
    /** The verified caller of a request: the tile's sign-in (401 without one), and only a
     * creator may manage uploads (403 otherwise). */
    async principal(request: FastifyRequest): Promise<VerifiedPrincipal> {
      const principal = await resources.guard.require(request);
      creatorChannel(principal);
      return principal;
    },
    upload,
    /** An upload's object key, under resources.prefix: `<prefix><videoId>/<uploadId>/source.mp4`. */
    originalKey(identity: { assetId: string; uploadId: string; file: UploadFile }): string {
      return originalKey(identity.assetId, identity.uploadId);
    },
    /** The job a completed upload publishes, from its outbox payload: the lifecycle's job. */
    job(payload: unknown, eventId: string): unknown {
      return requestedJob(payload, eventId);
    },
  };
}

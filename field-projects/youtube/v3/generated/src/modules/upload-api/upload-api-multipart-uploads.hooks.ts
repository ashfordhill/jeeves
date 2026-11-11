// Multipart uploads (Multipart uploads) in Upload API: the product hooks its multipart uploads template calls.
// Write them here. Export never overwrites your edits: export afresh and carry them over.
import type { FastifyRequest } from "fastify";
import type { VerifiedPrincipal } from "../../runtime/identity.ts";
import type { UploadFile, UploadHooks } from "../../runtime/owned-upload.ts";
import type { TileGuard } from "../../runtime/tile-guard.ts";
import { NotImplemented } from "../../runtime/tile-process.ts";

/** The template's generic resources: the key prefix it owns, the tile's sign-in and the lifecycle's upload hooks. */
export type UploadApiMultipartUploadsResources = {
  prefix: string;
  /** The tile's Auth guard, set to Required. */
  guard: TileGuard;
  /** The asset lifecycle (Lifecycle writer in Video lifecycle): it records each upload's asset. */
  lifecycle: Pick<UploadHooks<unknown, unknown>, "reserve" | "complete" | "closed">;
};

/** Each hook throws "Not implemented" until written; the first one a route reaches answers 501. */
export function uploadApiMultipartUploadsHooks(resources: UploadApiMultipartUploadsResources) {
  const upload: UploadHooks<unknown, unknown> = {
    /** Checks a start request: its file and metadata. */
    validate(input, principal) {
      throw new NotImplemented("validate for Multipart uploads");
    },
    /** Parses stored metadata. */
    metadata(input) {
      throw new NotImplemented("metadata for Multipart uploads");
    },
    /** Parses a stored completion response. */
    response(input) {
      throw new NotImplemented("response for Multipart uploads");
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
    /** The verified caller of a request: the tile's sign-in (401 without one). */
    async principal(request: FastifyRequest): Promise<VerifiedPrincipal> {
      return resources.guard.require(request);
    },
    upload,
    /** An upload's object key, under resources.prefix. */
    originalKey(identity: { assetId: string; uploadId: string; file: UploadFile }): string {
      throw new NotImplemented("originalKey for Multipart uploads");
    },
    /** The job a completed upload publishes, from its outbox payload. */
    job(payload: unknown, eventId: string): unknown {
      throw new NotImplemented("job for Multipart uploads");
    },
  };
}

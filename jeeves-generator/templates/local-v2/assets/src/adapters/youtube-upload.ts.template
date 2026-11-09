import type { FastifyRequest } from "fastify";
import { HttpError, type HttpRoutes } from "../runtime/http.ts";
import type { VerifiedPrincipal } from "../runtime/identity.ts";
import { createOwnedUploads, type UploadBinding } from "../runtime/owned-upload.ts";
import {
  createOwnedMultipart,
  type MultipartObjects,
  type UploadTransaction,
  type MultipartError,
} from "../runtime/multipart.ts";
import { createMultipartHttpHandlers } from "../runtime/multipart-http.ts";
import { originalKey } from "../features/video-paths.ts";
import {
  creator,
  newUpload,
  videoMetadata,
  completionResponse,
  failure,
  type VideoMetadata,
  type CompletionResponse,
} from "./youtube-contract.ts";
import type { YouTubeLifecycle } from "./youtube-lifecycle.ts";

export function creatorIdentity(principal: VerifiedPrincipal) {
  const roles = (principal.claims.realm_access as { roles?: unknown } | undefined)?.roles;
  if (!Array.isArray(roles) || !roles.includes("creator"))
    throw new HttpError(403, "CREATOR_REQUIRED", "A creator account is required.");
  const username =
    typeof principal.claims.preferred_username === "string"
      ? principal.claims.preferred_username.trim()
      : "";
  return creator.parse({
    sub: principal.subject,
    channel: (username || principal.subject).slice(0, 200),
  });
}
export function createCreatorPrincipal(verify: (bearer: string) => Promise<VerifiedPrincipal>) {
  return async (request: FastifyRequest): Promise<VerifiedPrincipal> => {
    const auth = request.headers.authorization;
    if (!auth?.startsWith("Bearer ") || auth.length > 16384)
      throw new HttpError(401, "SIGN_IN_REQUIRED", "Sign in again to manage uploads.");
    let principal: VerifiedPrincipal;
    try {
      principal = await verify(auth.slice(7));
    } catch {
      throw new HttpError(
        401,
        "SIGN_IN_REQUIRED",
        "Your sign-in is invalid or expired. Sign in again.",
      );
    }
    if (!principal.subject || principal.subject.length > 255)
      throw new HttpError(401, "SIGN_IN_REQUIRED", "Sign in again.");
    creatorIdentity(principal);
    return principal;
  };
}
export function validateYouTubeUpload(input: unknown, principal: VerifiedPrincipal) {
  const value = input as Record<string, unknown> | null;
  if (value && typeof value.size === "number" && (value.size > 268435456 || value.size < 1))
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
    metadata: videoMetadata.parse({
      title,
      description,
      channel: creatorIdentity(principal).channel,
    }),
  };
}
export function createYouTubeUpload(options: {
  binding: Omit<UploadBinding, "originalKey">;
  lifecycle: YouTubeLifecycle;
  transaction: UploadTransaction;
  objects: MultipartObjects<VideoMetadata, CompletionResponse>;
}) {
  const repository = createOwnedUploads(
    { ...options.binding, originalKey: ({ assetId, uploadId }) => originalKey(assetId, uploadId) },
    {
      validate: validateYouTubeUpload,
      metadata: (raw) => videoMetadata.parse(raw),
      response: (raw) => completionResponse.parse(raw),
      ...options.lifecycle.uploadHooks,
    },
  );
  return createOwnedMultipart({
    repository,
    transaction: options.transaction,
    objects: options.objects,
  });
}
export type YouTubeMultipart = ReturnType<typeof createYouTubeUpload>;
const uploadErrors: Record<string, string> = {
  UPLOAD_ID: "Invalid upload identity.",
  PART_NUMBER: "Invalid part number.",
  UPLOAD_NOT_FOUND: "Upload not found.",
  UPLOAD_CONFLICT: "This upload cannot perform that operation.",
  UPLOAD_CLOSED: "Upload closed. Choose a new file to start again.",
  UPLOAD_MISMATCH: "Stored original does not match this upload.",
  INCOMPLETE_PARTS:
    "Some parts are missing or have the wrong size. Reselect the same file and resume.",
  PARTS_LIMIT: "Unexpected part inventory. Abort and start a new upload.",
  INITIATION_FAILED: "Upload could not start. Check recent uploads before trying again.",
};
export function mountYouTubeUpload(
  routes: HttpRoutes,
  options: {
    multipart: YouTubeMultipart;
    lifecycle: YouTubeLifecycle;
    transaction: UploadTransaction;
    principal(request: FastifyRequest): Promise<VerifiedPrincipal>;
  },
) {
  async function asset(assetId: string) {
    const row = await options.transaction((tx) => options.lifecycle.get(tx, assetId));
    if (!row) throw new Error("Missing upload lifecycle");
    return row;
  }
  const http = createMultipartHttpHandlers({
    ...options,
    error: (error: MultipartError) =>
      new HttpError(
        error.statusCode,
        error.code,
        uploadErrors[error.code] ?? "Upload operation refused.",
      ),
    response: {
      start: ({ assetId, ...result }) => ({ ...result, videoId: assetId }),
      list: async ({ uploads }) => ({
        uploads: await Promise.all(
          uploads.map(async (upload) => {
            const row = await asset(upload.assetId);
            return {
              uploadId: upload.uploadId,
              videoId: upload.assetId,
              title: upload.metadata.title,
              state: row.state,
              createdAt: upload.createdAt,
              failure: failure(row.failureCode),
            };
          }),
        ),
      }),
      status: async (upload) => {
        const row = await asset(upload.assetId);
        return {
          uploadId: upload.uploadId,
          videoId: upload.assetId,
          title: upload.metadata.title,
          description: upload.metadata.description,
          state: row.state,
          phase: upload.phase,
          expiresAt: upload.expiresAt,
          createdAt: upload.createdAt,
          queuedAt: row.queuedAt,
          deadlineAt: row.deadlineAt,
          jobId: row.jobId,
          attemptId: row.attemptId,
          failure: failure(row.failureCode),
          file: upload.file,
          partSize: upload.partSize,
          partCount: upload.partCount,
          parts: upload.parts,
        };
      },
    },
  });
  routes.route({
    method: "GET",
    url: "/me",
    handler: async (request) => creatorIdentity(await options.principal(request)),
  });
  http.mount(routes, [
    { operation: "start", method: "POST", url: "/uploads", statusCode: 201 },
    { operation: "list", method: "GET", url: "/uploads" },
    { operation: "status", method: "GET", url: "/uploads/:uploadId" },
    { operation: "sign", method: "POST", url: "/uploads/:uploadId/parts/:partNumber" },
    { operation: "complete", method: "POST", url: "/uploads/:uploadId/complete", statusCode: 202 },
    { operation: "abort", method: "POST", url: "/uploads/:uploadId/abort" },
  ]);
}

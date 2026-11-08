import {
  AbortMultipartUploadCommand,
  CompleteMultipartUploadCommand,
  CreateMultipartUploadCommand,
  HeadObjectCommand,
  ListMultipartUploadsCommand,
  ListPartsCommand,
  UploadPartCommand,
  type S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import type pg from "pg";
import { newUpload, type NewUpload } from "../contracts/v1.ts";
import { HttpError } from "../lib/http.ts";
import { transaction } from "../state/transaction.ts";
import {
  beginComplete,
  cleanupUploads,
  clearCleanup,
  closeUpload,
  completeUpload,
  failUpload,
  interruptedUploads,
  ownedUpload,
  recentUploads,
  reopenIncomplete,
  reserveUpload,
  saveProviderUpload,
  type UploadRow,
} from "../state/video.ts";

export const PART_SIZE = 5 * 1024 * 1024;
const BUCKET = "youtube-v1-originals";
export interface Principal {
  sub: string;
  channel: string;
}
export interface Part {
  partNumber: number;
  size: number;
  etag: string;
}
const missing = (e: unknown) =>
  ["NoSuchUpload", "NotFound", "NoSuchKey"].includes((e as Error)?.name);
const conflict = () =>
  new HttpError(409, "UPLOAD_CONFLICT", "This upload cannot perform that operation.");
export function parseUpload(input: unknown): NewUpload {
  const v = input as Record<string, unknown> | null;
  if (v && typeof v.size === "number" && (v.size > 256 * 1024 * 1024 || v.size < 1))
    throw new HttpError(413, "FILE_SIZE", "Choose a file between 1 byte and 256 MiB.");
  if (
    v &&
    (v.contentType !== "video/mp4" || typeof v.fileName !== "string" || !/\.mp4$/i.test(v.fileName))
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
  return parsed.data;
}
export function validateParts(parts: Part[], size: number) {
  const count = Math.ceil(size / PART_SIZE);
  if (
    parts.length !== count ||
    parts.some(
      (p, i) =>
        p.partNumber !== i + 1 || !p.etag || p.size !== Math.min(PART_SIZE, size - i * PART_SIZE),
    )
  )
    throw new HttpError(
      409,
      "INCOMPLETE_PARTS",
      "Some parts are missing or have the wrong size. Reselect the same file and resume.",
    );
}
export function uploadView(r: UploadRow, parts: Part[] = []) {
  return {
    uploadId: r.upload_id,
    videoId: r.video_id,
    title: r.title,
    description: r.description,
    state: r.state,
    phase: r.phase,
    expiresAt: r.expires_at,
    createdAt: r.created_at,
    queuedAt: r.queued_at,
    deadlineAt: r.deadline_at,
    jobId: r.job_id,
    attemptId: r.attempt_id,
    failure: r.failure_code ? { code: r.failure_code, message: r.failure_message } : null,
    file: {
      fileName: r.file_name,
      size: Number(r.size),
      contentType: r.content_type,
      lastModified: Number(r.last_modified),
      sha256: r.sha256,
    },
    partSize: PART_SIZE,
    partCount: Math.ceil(Number(r.size) / PART_SIZE),
    parts,
  };
}
export class UploadMultipart {
  private orphanKey: string | undefined;
  private orphanId: string | undefined;
  constructor(
    readonly pool: pg.Pool,
    readonly control: S3Client,
    readonly signing: S3Client,
  ) {}
  private tx<T>(f: Parameters<typeof transaction<T>>[1]) {
    return transaction(this.pool, f);
  }
  private async row(id: string, sub: string) {
    let r = await this.tx((tx) => ownedUpload(tx, id, sub));
    if (!r) throw new HttpError(404, "UPLOAD_NOT_FOUND", "Upload not found.");
    if (r.state === "uploading" && r.expires_at <= r.db_now) {
      await this.tx((tx) => closeUpload(tx, id, sub, "expired"));
      r = (await this.tx((tx) => ownedUpload(tx, id, sub)))!;
    }
    return r;
  }
  private active(r: UploadRow) {
    if (r.state === "expired" || r.state === "aborted")
      throw new HttpError(
        410,
        "UPLOAD_CLOSED",
        `Upload ${r.state}. Choose a new file to start again.`,
      );
    if (r.state !== "uploading" || r.phase !== "active" || !r.provider_upload_id) throw conflict();
  }
  async start(principal: Principal, input: unknown) {
    const f = parseUpload(input),
      saved = await this.tx((tx) => reserveUpload(tx, principal, f));
    let providerId: string | undefined;
    try {
      const result = await this.control.send(
        new CreateMultipartUploadCommand({
          Bucket: BUCKET,
          Key: saved.originalKey,
          ContentType: "video/mp4",
          Metadata: {
            "video-id": saved.videoId,
            "upload-id": saved.uploadId,
            sha256: f.sha256,
            "expected-size": String(f.size),
          },
        }),
        { abortSignal: AbortSignal.timeout(4000) },
      );
      providerId = result.UploadId;
      if (!providerId) throw new Error("Missing upload identity");
      const stored = await this.tx((tx) =>
        saveProviderUpload(tx, saved.uploadId, principal.sub, providerId!),
      );
      if (stored.outcome !== "active") throw conflict();
    } catch {
      await this.tx((tx) => failUpload(tx, saved.uploadId, principal.sub, "INITIATION_FAILED"));
      if (providerId) await this.abortProvider(saved.originalKey, providerId).catch(() => {});
      throw new HttpError(
        503,
        "INITIATION_FAILED",
        "Upload could not start. Check recent uploads before trying again.",
      );
    }
    return {
      uploadId: saved.uploadId,
      videoId: saved.videoId,
      state: "uploading",
      partSize: PART_SIZE,
      partCount: Math.ceil(f.size / PART_SIZE),
      expiresAt: saved.expiresAt,
    };
  }
  async list(sub: string) {
    const rows = await this.tx((tx) => recentUploads(tx, sub));
    return {
      uploads: rows.map((r) => ({
        uploadId: r.upload_id,
        videoId: r.video_id,
        title: r.title,
        state: r.state,
        createdAt: r.created_at,
        failure: r.failure_code ? { code: r.failure_code, message: r.failure_message } : null,
      })),
    };
  }
  async parts(r: UploadRow) {
    if (!r.provider_upload_id) return [];
    const parts: Part[] = [];
    let marker: string | undefined;
    // Transport maximum is 52 parts; reject unexpected provider data rather than an unbounded loop.
    for (let page = 0; page < 3; page++) {
      const result = await this.control.send(
        new ListPartsCommand({
          Bucket: BUCKET,
          Key: r.original_key,
          UploadId: r.provider_upload_id,
          PartNumberMarker: marker,
          MaxParts: 100,
        }),
        { abortSignal: AbortSignal.timeout(4000) },
      );
      for (const p of result.Parts ?? []) {
        if (!p.PartNumber || p.Size === undefined || !p.ETag) throw conflict();
        parts.push({ partNumber: p.PartNumber, size: p.Size, etag: p.ETag });
      }
      if (!result.IsTruncated) return parts.sort((a, b) => a.partNumber - b.partNumber);
      if (!result.NextPartNumberMarker || result.NextPartNumberMarker === marker) break;
      marker = result.NextPartNumberMarker;
    }
    throw new HttpError(
      409,
      "PARTS_LIMIT",
      "Unexpected part inventory. Abort and start a new upload.",
    );
  }
  async status(id: string, sub: string) {
    let r = await this.row(id, sub);
    if (r.phase === "completing" && r.state === "uploading") {
      await this.complete(id, sub).catch((e) => {
        if (!(e instanceof HttpError) || e.statusCode >= 500) throw e;
      });
      r = await this.row(id, sub);
    }
    let parts: Part[] = [];
    if (r.state === "uploading" && r.phase === "active") {
      try {
        parts = await this.parts(r);
      } catch (e) {
        if (!missing(e)) throw e;
        await this.tx((tx) => failUpload(tx, id, sub, "UPLOAD_MISMATCH"));
        r = await this.row(id, sub);
      }
    }
    return uploadView(r, parts);
  }
  async sign(id: string, sub: string, number: number) {
    const r = await this.row(id, sub);
    this.active(r);
    if (!Number.isInteger(number) || number < 1 || number > Math.ceil(Number(r.size) / PART_SIZE))
      throw new HttpError(400, "PART_NUMBER", "Invalid part number.");
    const url = await getSignedUrl(
      this.signing,
      new UploadPartCommand({
        Bucket: BUCKET,
        Key: r.original_key,
        UploadId: r.provider_upload_id!,
        PartNumber: number,
      }),
      { expiresIn: 900 },
    );
    return { url, expiresAt: new Date(Date.now() + 900000).toISOString() };
  }
  private async head(r: UploadRow) {
    const h = await this.control.send(
      new HeadObjectCommand({ Bucket: BUCKET, Key: r.original_key }),
      { abortSignal: AbortSignal.timeout(4000) },
    );
    if (
      h.ContentLength !== Number(r.size) ||
      h.Metadata?.["video-id"] !== r.video_id ||
      h.Metadata?.["upload-id"] !== r.upload_id ||
      h.Metadata?.sha256 !== r.sha256 ||
      h.Metadata?.["expected-size"] !== r.size ||
      !h.ETag
    ) {
      await this.tx((tx) => failUpload(tx, r.upload_id, r.creator_sub, "UPLOAD_MISMATCH"));
      throw new HttpError(409, "UPLOAD_MISMATCH", "Stored original does not match this upload.");
    }
    return { key: r.original_key, size: h.ContentLength, etag: h.ETag };
  }
  async complete(id: string, sub: string) {
    let r = await this.row(id, sub);
    if (r.complete_response) return r.complete_response;
    if (r.phase !== "completing") this.active(r);
    let parts: Part[] | null;
    try {
      parts = await this.parts(r);
    } catch (e) {
      if (!missing(e) || r.phase !== "completing") throw e;
      parts = null;
    }
    if (parts) {
      try {
        validateParts(parts, Number(r.size));
      } catch (e) {
        await this.tx((tx) => reopenIncomplete(tx, id, sub));
        throw e;
      }
    }
    const begun = await this.tx((tx) => beginComplete(tx, id, sub));
    if (begun.outcome === "duplicate") return begun.upload.complete_response!;
    if (begun.outcome === "expired") throw new HttpError(410, "UPLOAD_CLOSED", "Upload expired.");
    if (begun.outcome !== "completing") throw conflict();
    r = begun.upload;
    if (parts) {
      try {
        await this.control.send(
          new CompleteMultipartUploadCommand({
            Bucket: BUCKET,
            Key: r.original_key,
            UploadId: r.provider_upload_id!,
            MultipartUpload: {
              Parts: parts.map((p) => ({ PartNumber: p.partNumber, ETag: p.etag })),
            },
          }),
          { abortSignal: AbortSignal.timeout(4000) },
        );
      } catch (e) {
        if (!missing(e)) throw e;
      }
    }
    let verified;
    try {
      verified = await this.head(r);
    } catch (e) {
      if (missing(e)) {
        await this.tx((tx) => failUpload(tx, id, sub, "UPLOAD_MISMATCH"));
        throw new HttpError(
          409,
          "UPLOAD_MISMATCH",
          "Completed original is unavailable. Start a new upload.",
        );
      }
      throw e;
    }
    const result = await this.tx((tx) => completeUpload(tx, id, sub, verified));
    if (result.outcome === "pending" || result.outcome === "duplicate") return result.response;
    if (result.outcome === "expired") throw new HttpError(410, "UPLOAD_CLOSED", "Upload expired.");
    throw conflict();
  }
  private async abortProvider(key: string, providerId: string) {
    try {
      await this.control.send(
        new AbortMultipartUploadCommand({ Bucket: BUCKET, Key: key, UploadId: providerId }),
        { abortSignal: AbortSignal.timeout(4000) },
      );
    } catch (e) {
      if (!missing(e)) throw e;
    }
  }
  async abort(id: string, sub: string) {
    const r = await this.row(id, sub);
    const result = await this.tx((tx) => closeUpload(tx, id, sub, "aborted"));
    if (result.outcome === "expired") throw new HttpError(410, "UPLOAD_CLOSED", "Upload expired.");
    if (result.outcome !== "aborted") throw conflict();
    if (r.provider_upload_id) await this.abortProvider(r.original_key, r.provider_upload_id);
    await this.tx((tx) => clearCleanup(tx, id));
    return { uploadId: id, state: "aborted" };
  }
  async sweep() {
    for (const r of await this.tx((tx) => cleanupUploads(tx))) {
      await this.tx((tx) => closeUpload(tx, r.upload_id, r.creator_sub, "expired"));
      if (r.provider_upload_id) await this.abortProvider(r.original_key, r.provider_upload_id);
      await this.tx((tx) => clearCleanup(tx, r.upload_id));
    }
    for (const i of await this.tx((tx) => interruptedUploads(tx))) {
      const r = await this.row(i.upload_id, i.creator_sub);
      if (r.phase === "initiating")
        await this.tx((tx) => failUpload(tx, r.upload_id, r.creator_sub, "INITIATION_FAILED"));
      else
        await this.complete(i.upload_id, i.creator_sub).catch((e) => {
          if (!(e instanceof HttpError) || e.statusCode >= 500) throw e;
        });
    }
    const result = await this.control.send(
      new ListMultipartUploadsCommand({
        Bucket: BUCKET,
        Prefix: "originals/",
        MaxUploads: 50,
        KeyMarker: this.orphanKey,
        UploadIdMarker: this.orphanId,
      }),
      { abortSignal: AbortSignal.timeout(4000) },
    );
    for (const u of result.Uploads ?? []) {
      if (
        u.Key &&
        u.UploadId &&
        u.Initiated &&
        u.Initiated.getTime() < Date.now() - 86400000 &&
        /^originals\/[a-f0-9-]{36}\/[a-f0-9-]{36}\/source\.mp4$/.test(u.Key)
      )
        await this.abortProvider(u.Key, u.UploadId);
    }
    this.orphanKey = result.IsTruncated ? result.NextKeyMarker : undefined;
    this.orphanId = result.IsTruncated ? result.NextUploadIdMarker : undefined;
  }
}

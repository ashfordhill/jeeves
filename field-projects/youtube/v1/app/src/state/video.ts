import { randomUUID } from "node:crypto";
import {
  creator,
  failureCode,
  logicalEventId,
  mediaResult,
  newUpload,
  nextProcessingState,
  originalKey,
  processingEvent,
  processingRequested,
  safeFailureMessages,
  uuid,
  videoPublished,
  type NewUpload,
  type ProcessingEvent,
  type FailureCode,
} from "../contracts/v1.ts";
import type { Tx } from "./transaction.ts";
export type VideoStatus =
  | "uploading"
  | "pending"
  | "processing"
  | "ready"
  | "failed"
  | "aborted"
  | "expired";
export interface VideoRow {
  video_id: string;
  creator_sub: string;
  channel: string;
  title: string;
  description: string;
  expected_size: string;
  expected_sha256: string;
  state: VideoStatus;
  state_version: number;
  job_id: string | null;
  attempt_id: string | null;
  created_at: Date;
  updated_at: Date;
  expires_at: Date;
  queued_at: Date | null;
  started_at: Date | null;
  deadline_at: Date | null;
  failure_code: FailureCode | null;
  failure_message: string | null;
  media: unknown;
  publication_version: 1 | null;
  published_at: Date | null;
  db_now: Date;
}
export interface CompleteResponse {
  videoId: string;
  uploadId: string;
  jobId: string;
  attemptId: string;
  state: "pending";
}
export interface UploadRow extends VideoRow {
  upload_id: string;
  original_key: string;
  provider_upload_id: string | null;
  phase: "initiating" | "active" | "completing" | "closed";
  file_name: string;
  size: string;
  content_type: "video/mp4";
  last_modified: string;
  sha256: string;
  complete_response: CompleteResponse | null;
  original_etag: string | null;
  cleanup_needed: boolean;
}
export type CompleteResult =
  | { outcome: "pending" | "duplicate"; response: CompleteResponse }
  | { outcome: "unknown" | "conflict" | "expired" | "mismatch" };
export type BeginCompleteResult =
  | { outcome: "unknown"; upload: null }
  | { outcome: "duplicate" | "conflict" | "expired" | "completing"; upload: UploadRow };
export type CreatorVideoRow = Pick<
  VideoRow,
  | "video_id"
  | "title"
  | "state"
  | "state_version"
  | "job_id"
  | "attempt_id"
  | "created_at"
  | "updated_at"
  | "failure_code"
  | "failure_message"
>;
function requireTransition(result: { rowCount: number | null }) {
  if (result.rowCount !== 1) throw new Error("Conditional state transition refused");
}
// Every exported mutation receives a transaction client. Use transaction(pool, tx=>...) at the service boundary.
export async function reserveUpload(
  tx: Tx,
  principal: { sub: string; channel: string },
  input: NewUpload,
) {
  const c = creator.parse(principal),
    f = newUpload.parse(input),
    videoId = randomUUID(),
    uploadId = randomUUID(),
    key = originalKey(videoId, uploadId);
  const v = await tx.query<VideoRow>(
    `INSERT INTO video_private.videos(video_id,creator_sub,channel,title,description,expected_size,expected_sha256) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
    [videoId, c.sub, c.channel, f.title, f.description, f.size, f.sha256],
  );
  await tx.query(
    `INSERT INTO video_private.uploads(upload_id,video_id,original_key,file_name,size,content_type,last_modified,sha256,expires_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
    [
      uploadId,
      videoId,
      key,
      f.fileName,
      f.size,
      f.contentType,
      f.lastModified,
      f.sha256,
      v.rows[0]!.expires_at,
    ],
  );
  return { videoId, uploadId, originalKey: key, expiresAt: v.rows[0]!.expires_at };
}
export async function ownedUpload(tx: Tx, uploadId: string, sub: string, lock = false) {
  return (
    (
      await tx.query<UploadRow>(
        `SELECT v.*,u.upload_id,u.original_key,u.provider_upload_id,u.phase,u.file_name,u.size,u.content_type,u.last_modified,u.sha256,u.complete_response,u.original_etag,u.cleanup_needed,clock_timestamp() AS db_now FROM video_private.videos v JOIN video_private.uploads u USING(video_id) WHERE u.upload_id=$1 AND v.creator_sub=$2 ${lock ? "FOR UPDATE OF v,u" : ""}`,
        [uuid.parse(uploadId), sub],
      )
    ).rows[0] ?? null
  );
}
export type RecentUploadRow = Omit<CreatorVideoRow, "job_id" | "attempt_id"> & {
  upload_id: string;
};
export interface CleanupUploadRow {
  upload_id: string;
  video_id: string;
  original_key: string;
  provider_upload_id: string | null;
  creator_sub: string;
}
export async function recentUploads(tx: Tx, sub: string) {
  return (
    await tx.query<RecentUploadRow>(
      `SELECT v.video_id,u.upload_id,v.title,v.state,v.state_version,v.created_at,v.updated_at,v.failure_code,v.failure_message FROM video_private.videos v JOIN video_private.uploads u USING(video_id) WHERE creator_sub=$1 ORDER BY created_at DESC LIMIT 50`,
      [sub],
    )
  ).rows;
}
export async function creatorVideo(tx: Tx, videoId: string, sub: string) {
  return (
    (
      await tx.query<CreatorVideoRow>(
        `SELECT video_id,title,state,state_version,job_id,attempt_id,created_at,updated_at,failure_code,failure_message FROM video_private.videos WHERE video_id=$1 AND creator_sub=$2`,
        [uuid.parse(videoId), sub],
      )
    ).rows[0] ?? null
  );
}
export async function saveProviderUpload(
  tx: Tx,
  uploadId: string,
  sub: string,
  providerId: string,
) {
  if (!providerId || providerId.length > 2048) throw new Error("Invalid provider upload identity");
  const r = await ownedUpload(tx, uploadId, sub, true);
  if (!r) return { outcome: "unknown" };
  if (r.state !== "uploading" || r.phase !== "initiating") return { outcome: "conflict" };
  if (r.expires_at <= r.db_now) {
    await closeUpload(tx, uploadId, sub, "expired");
    return { outcome: "expired" };
  }
  await tx.query(
    `UPDATE video_private.uploads SET provider_upload_id=$2,phase='active' WHERE upload_id=$1`,
    [uploadId, providerId],
  );
  return { outcome: "active" };
}
export async function beginComplete(
  tx: Tx,
  uploadId: string,
  sub: string,
): Promise<BeginCompleteResult> {
  const r = await ownedUpload(tx, uploadId, sub, true);
  if (!r) return { outcome: "unknown", upload: null };
  if (r.complete_response) return { outcome: "duplicate", upload: r };
  if (r.state !== "uploading" || !["active", "completing"].includes(r.phase))
    return { outcome: "conflict", upload: r };
  if (r.expires_at <= r.db_now) {
    await closeUpload(tx, uploadId, sub, "expired");
    return { outcome: "expired", upload: r };
  }
  await tx.query(`UPDATE video_private.uploads SET phase='completing' WHERE upload_id=$1`, [
    uploadId,
  ]);
  return { outcome: "completing", upload: r };
}
export async function completeUpload(
  tx: Tx,
  uploadId: string,
  sub: string,
  verified: { key: string; size: number; etag: string },
): Promise<CompleteResult> {
  const r = await ownedUpload(tx, uploadId, sub, true);
  if (!r) return { outcome: "unknown" };
  if (r.complete_response) return { outcome: "duplicate", response: r.complete_response };
  if (r.state !== "uploading" || r.phase !== "completing") return { outcome: "conflict" };
  if (r.expires_at <= r.db_now) {
    await closeUpload(tx, uploadId, sub, "expired");
    return { outcome: "expired" };
  }
  if (
    verified.key !== r.original_key ||
    verified.size !== Number(r.expected_size) ||
    !verified.etag ||
    verified.etag.length > 1024
  )
    return { outcome: "mismatch" };
  const jobId = randomUUID(),
    attemptId = randomUUID(),
    at = r.db_now.toISOString(),
    eventId = logicalEventId(jobId, attemptId, "VideoProcessingRequested");
  const message = processingRequested.parse({
    schemaVersion: 1,
    type: "VideoProcessingRequested",
    eventId,
    occurredAt: at,
    videoId: r.video_id,
    jobId,
    attemptId,
    originalKey: r.original_key,
    expectedSize: Number(r.expected_size),
    expectedSha256: r.expected_sha256,
  });
  const response: CompleteResponse = {
    videoId: r.video_id,
    uploadId,
    jobId,
    attemptId,
    state: "pending",
  };
  requireTransition(
    await tx.query(
      `UPDATE video_private.videos SET state='pending',state_version=state_version+1,job_id=$2,attempt_id=$3,queued_at=clock_timestamp(),deadline_at=clock_timestamp()+interval '10 minutes',updated_at=clock_timestamp() WHERE video_id=$1 AND state='uploading' AND state_version=$4`,
      [r.video_id, jobId, attemptId, r.state_version],
    ),
  );
  await tx.query(
    `UPDATE video_private.uploads SET phase='closed',complete_response=$2,original_etag=$3 WHERE upload_id=$1`,
    [uploadId, response, verified.etag],
  );
  await tx.query(
    `INSERT INTO video_private.outbox(event_id,destination,intent_key,payload) VALUES($1,'upload-jobs',$2,$3)`,
    [eventId, `job:${jobId}`, message],
  );
  return { outcome: "pending", response };
}
export async function closeUpload(
  tx: Tx,
  uploadId: string,
  sub: string,
  target: "aborted" | "expired",
) {
  const r = await ownedUpload(tx, uploadId, sub, true);
  if (!r) return { outcome: "unknown" };
  if (r.state !== "uploading") return { outcome: r.state };
  const state = r.expires_at <= r.db_now ? "expired" : target;
  if (state === "expired" && r.expires_at > r.db_now) return { outcome: "not-due" };
  await tx.query(
    `UPDATE video_private.videos SET state=$2,state_version=state_version+1,updated_at=clock_timestamp() WHERE video_id=$1 AND state='uploading'`,
    [r.video_id, state],
  );
  await tx.query(
    `UPDATE video_private.uploads SET phase='closed',cleanup_needed=true WHERE upload_id=$1`,
    [uploadId],
  );
  return { outcome: state };
}
export async function failUpload(
  tx: Tx,
  uploadId: string,
  sub: string,
  code: "INITIATION_FAILED" | "UPLOAD_MISMATCH",
) {
  const r = await ownedUpload(tx, uploadId, sub, true);
  if (!r || r.state !== "uploading") return false;
  await tx.query(
    `UPDATE video_private.videos SET state='failed',state_version=state_version+1,failure_code=$2,failure_message=$3,updated_at=clock_timestamp() WHERE video_id=$1`,
    [r.video_id, code, safeFailureMessages[code]],
  );
  await tx.query(
    `UPDATE video_private.uploads SET phase='closed',cleanup_needed=true WHERE upload_id=$1`,
    [uploadId],
  );
  return true;
}
export async function cleanupUploads(tx: Tx) {
  return (
    await tx.query<CleanupUploadRow>(
      `SELECT u.upload_id,u.video_id,u.original_key,u.provider_upload_id,v.creator_sub FROM video_private.uploads u JOIN video_private.videos v USING(video_id) WHERE u.cleanup_needed OR (v.state='uploading' AND u.expires_at<=clock_timestamp()) ORDER BY u.expires_at LIMIT 50`,
    )
  ).rows;
}
export async function clearCleanup(tx: Tx, uploadId: string) {
  await tx.query(
    `UPDATE video_private.uploads SET cleanup_needed=false WHERE upload_id=$1 AND phase='closed'`,
    [uuid.parse(uploadId)],
  );
}
export async function applyProcessing(tx: Tx, input: ProcessingEvent) {
  const e = processingEvent.parse(input); // poison messages are rejected before receipts; known stale/unknown identities get safe receipts.
  const row = (
    await tx.query<VideoRow>(
      `SELECT *,clock_timestamp() AS db_now FROM video_private.videos WHERE video_id=$1 FOR UPDATE`,
      [e.videoId],
    )
  ).rows[0];
  const previous = await tx.query("SELECT outcome FROM video_private.inbox WHERE event_id=$1", [
    e.eventId,
  ]);
  if (previous.rowCount) return { outcome: "duplicate", previous: previous.rows[0].outcome };
  let outcome: "started" | "ready" | "failed" | "stale" | "terminal" | "unknown" = row
    ? nextProcessingState(
        row.state,
        e.type,
        row.job_id === e.jobId && row.attempt_id === e.attemptId,
      )
    : "unknown";
  // Enforce the fixed DB deadline even if the periodic sweeper has not run yet.
  if (
    row &&
    ["pending", "processing"].includes(row.state) &&
    row.deadline_at !== null &&
    row.deadline_at <= row.db_now
  ) {
    await failJob(
      tx,
      row.video_id,
      row.state === "pending" ? "QUEUE_DEADLINE" : "PROCESSING_DEADLINE",
    );
    outcome = "terminal";
  }
  if (row && outcome === "started" && row.state === "pending")
    requireTransition(
      await tx.query(
        `UPDATE video_private.videos SET state='processing',state_version=state_version+1,started_at=clock_timestamp(),deadline_at=clock_timestamp()+interval '30 minutes',updated_at=clock_timestamp() WHERE video_id=$1 AND state_version=$2`,
        [e.videoId, row.state_version],
      ),
    );
  if (outcome === "failed" && e.type === "ProcessingFailed") await failJob(tx, e.videoId, e.code);
  if (row && outcome === "ready" && e.type === "ProcessingSucceeded") {
    const result = mediaResult.parse(e.result),
      publishedAt = row.db_now.toISOString();
    const publication = videoPublished.parse({
      schemaVersion: 1,
      type: "VideoPublished",
      eventId: logicalEventId(e.videoId, "publication", "1"),
      occurredAt: publishedAt,
      videoId: e.videoId,
      publicationVersion: 1,
      visibility: "public",
      state: "ready",
      title: row.title,
      description: row.description,
      channel: row.channel,
      durationSeconds: result.durationSeconds,
      manifest: result.manifest,
      thumbnail: result.thumbnail,
      publishedAt,
    });
    requireTransition(
      await tx.query(
        `UPDATE video_private.videos SET state='ready',state_version=state_version+1,media=$2,publication_version=1,published_at=$3,updated_at=clock_timestamp() WHERE video_id=$1 AND state_version=$4`,
        [e.videoId, result, publishedAt, row.state_version],
      ),
    );
    await tx.query(
      `INSERT INTO video_private.outbox(event_id,destination,intent_key,payload) VALUES($1,'publication-events',$2,$3)`,
      [publication.eventId, `publication:${e.videoId}:1`, publication],
    );
  }
  await tx.query(
    `INSERT INTO video_private.inbox(event_id,video_id,job_id,attempt_id,outcome) VALUES($1,$2,$3,$4,$5)`,
    [e.eventId, e.videoId, e.jobId, e.attemptId, outcome],
  );
  return { outcome };
}
async function failJob(tx: Tx, videoId: string, code: FailureCode) {
  failureCode.parse(code);
  await tx.query(
    `UPDATE video_private.videos SET state='failed',state_version=state_version+1,failure_code=$2,failure_message=$3,updated_at=clock_timestamp() WHERE video_id=$1 AND state IN ('pending','processing')`,
    [videoId, code, safeFailureMessages[code]],
  );
}
export async function sweepJobs(tx: Tx) {
  const rows = await tx.query(
    `SELECT video_id,state FROM video_private.videos WHERE state IN ('pending','processing') AND deadline_at<=clock_timestamp() ORDER BY deadline_at LIMIT 50 FOR UPDATE SKIP LOCKED`,
  );
  for (const r of rows.rows)
    await failJob(tx, r.video_id, r.state === "pending" ? "QUEUE_DEADLINE" : "PROCESSING_DEADLINE");
  return rows.rowCount;
}

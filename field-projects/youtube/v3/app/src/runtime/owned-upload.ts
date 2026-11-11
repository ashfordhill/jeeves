import { randomUUID } from "node:crypto";
import {
  durableIdentity,
  jsonPayload,
  qualifiedRelation,
  type SqlRelation,
} from "./durable-sql.ts";
import type { VerifiedPrincipal } from "./identity.ts";
import { abortTransaction, assertTransaction, type Tx } from "./transaction.ts";

export type UploadPrincipal = Pick<VerifiedPrincipal, "subject">;
export interface UploadFile {
  fileName: string;
  size: number;
  contentType: string;
  lastModified: number;
  sha256: string;
}
export type UploadState = "uploading" | "completed" | "failed" | "aborted" | "expired";
export type UploadPhase = "initiating" | "active" | "completing" | "closed";
export type UploadFailure = "INITIATION_FAILED" | "UPLOAD_MISMATCH";
export interface UploadRecord<Metadata, Response> {
  uploadId: string;
  assetId: string;
  ownerSubject: string;
  originalKey: string;
  providerUploadId: string | null;
  state: UploadState;
  phase: UploadPhase;
  file: UploadFile;
  metadata: Metadata;
  createdAt: Date;
  updatedAt: Date;
  expiresAt: Date;
  dbNow: Date;
  completeResponse: Response | null;
  originalEtag: string | null;
  failureCode: UploadFailure | null;
  cleanupNeeded: boolean;
}
/** Constructed by trusted transport after provider inventory/Head metadata verification.
 * The declared SHA is a source fingerprint, not proof that Head hashed the object bytes. */
export interface VerifiedOriginal {
  key: string;
  size: number;
  sha256: string;
  etag: string;
}
export type UploadTerminal =
  | { state: "aborted" | "expired" }
  | { state: "failed"; code: UploadFailure };
export interface UploadHooks<Metadata, Response> {
  /** Pure application content/metadata validation. Principal is supplied by verified caller. */
  validate(input: unknown, principal: VerifiedPrincipal): { file: UploadFile; metadata: Metadata };
  /** Codecs validate JSON snapshots on both write and read. No executable source input. */
  metadata(input: unknown): Metadata;
  response(input: unknown): Response;
  reserve(tx: Tx, upload: UploadRecord<Metadata, Response>): Promise<void>;
  complete(
    tx: Tx,
    upload: UploadRecord<Metadata, Response>,
    original: VerifiedOriginal,
  ): Promise<Response>;
  /** Same transaction as abort/expiry/initiation or fingerprint failure, once per transition. */
  closed(tx: Tx, upload: UploadRecord<Metadata, Response>, terminal: UploadTerminal): Promise<void>;
}
export type UploadBinding = SqlRelation & {
  originalKey(identity: { assetId: string; uploadId: string; file: UploadFile }): string;
};
export type BeginUploadCompletion<M, R> =
  | { outcome: "unknown"; upload: null }
  | { outcome: "duplicate" | "conflict" | "expired" | "completing"; upload: UploadRecord<M, R> };
export type UploadCompletion<R> =
  | { outcome: "completed" | "duplicate"; response: R }
  | { outcome: "unknown" | "conflict" | "expired" | "mismatch" };
export interface OwnedUploadRepository<M, R> {
  reserve(tx: Tx, principal: VerifiedPrincipal, input: unknown): Promise<UploadRecord<M, R>>;
  owned(
    tx: Tx,
    uploadId: string,
    principal: UploadPrincipal,
    lock?: boolean,
  ): Promise<UploadRecord<M, R> | null>;
  recent(tx: Tx, principal: UploadPrincipal): Promise<UploadRecord<M, R>[]>;
  saveProvider(
    tx: Tx,
    uploadId: string,
    principal: UploadPrincipal,
    providerId: string,
  ): Promise<{ outcome: "unknown" | "conflict" | "expired" | "active" }>;
  beginComplete(
    tx: Tx,
    uploadId: string,
    principal: UploadPrincipal,
  ): Promise<BeginUploadCompletion<M, R>>;
  complete(
    tx: Tx,
    uploadId: string,
    principal: UploadPrincipal,
    original: VerifiedOriginal,
  ): Promise<UploadCompletion<R>>;
  close(
    tx: Tx,
    uploadId: string,
    principal: UploadPrincipal,
    target: "aborted" | "expired",
  ): Promise<{ outcome: UploadState | "unknown" | "not-due" }>;
  fail(tx: Tx, uploadId: string, principal: UploadPrincipal, code: UploadFailure): Promise<boolean>;
  reopenIncomplete(tx: Tx, uploadId: string, principal: UploadPrincipal): Promise<void>;
  /** Privileged internal sweeper operations, never public owner-selectable routes. */
  cleanup(tx: Tx): Promise<UploadRecord<M, R>[]>;
  interrupted(tx: Tx): Promise<UploadRecord<M, R>[]>;
  clearCleanup(tx: Tx, uploadId: string): Promise<void>;
}
interface StoredUpload {
  [column: string]: unknown;
  upload_id: string;
  asset_id: string;
  owner_subject: string;
  original_key: string;
  provider_upload_id: string | null;
  state: UploadState;
  phase: UploadPhase;
  file_name: string;
  size: string;
  content_type: string;
  last_modified: string;
  sha256: string;
  metadata: unknown;
  created_at: Date;
  updated_at: Date;
  expires_at: Date;
  db_now: Date;
  complete_response: unknown;
  original_etag: string | null;
  failure_code: UploadFailure | null;
  cleanup_needed: boolean;
}
const uuid = (value: string) => {
  if (
    typeof value !== "string" ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
  )
    throw new Error("Invalid upload identity");
  return value.toLowerCase();
};
function subject(principal: UploadPrincipal): string {
  const value = durableIdentity(principal.subject);
  if (value.length > 255) throw new Error("Invalid upload principal");
  return value;
}
function fileSnapshot(file: UploadFile): UploadFile {
  if (
    typeof file.fileName !== "string" ||
    !file.fileName.length ||
    file.fileName.length > 255 ||
    /[\x00-\x1f\x7f/\\]/.test(file.fileName) ||
    !Number.isSafeInteger(file.size) ||
    file.size < 1 ||
    file.size > 268435456 ||
    typeof file.contentType !== "string" ||
    !file.contentType.length ||
    file.contentType.length > 255 ||
    /[\x00-\x1f\x7f]/.test(file.contentType) ||
    !Number.isSafeInteger(file.lastModified) ||
    file.lastModified < 0 ||
    typeof file.sha256 !== "string" ||
    !/^[0-9a-f]{64}$/.test(file.sha256)
  )
    throw new Error("Invalid upload fingerprint");
  return {
    fileName: file.fileName,
    size: file.size,
    contentType: file.contentType,
    lastModified: file.lastModified,
    sha256: file.sha256,
  };
}
/** All hook/codec failures poison the caller's Tx, even if it catches the rejection. */
async function atomic<T>(tx: Tx, effect: () => Promise<T>): Promise<T> {
  assertTransaction(tx);
  try {
    return await effect();
  } catch (error) {
    return abortTransaction(tx, error);
  }
}
function snapshot<T>(codec: (input: unknown) => T, value: unknown): { value: T; json: string } {
  function jsonData(input: unknown): string {
    function check(v: unknown): void {
      if (v === null || typeof v === "string" || typeof v === "boolean") return;
      if (typeof v === "number" && Number.isFinite(v)) return;
      if (Array.isArray(v)) {
        for (const item of v) check(item);
        return;
      }
      if (
        typeof v === "object" &&
        v !== null &&
        (Object.getPrototypeOf(v) === Object.prototype || Object.getPrototypeOf(v) === null)
      ) {
        for (const item of Object.values(v)) check(item);
        return;
      }
      throw new Error("Upload metadata/response must be JSON data");
    }
    check(input);
    return jsonPayload(input);
  }
  const json = jsonData(codec(JSON.parse(jsonData(value))));
  const parsed: unknown = JSON.parse(json);
  if (parsed === null) throw new Error("Upload metadata/response must be non-null JSON");
  const normalized = codec(parsed);
  if (jsonData(normalized) !== json) throw new Error("Unstable upload codec");
  return { value: normalized, json };
}

/** SQL only. Provider work belongs outside this transaction and can remain uncertain. */
export function createOwnedUploads<M, R>(
  binding: UploadBinding,
  hooks: UploadHooks<M, R>,
): OwnedUploadRepository<M, R> {
  const table = qualifiedRelation(binding),
    keyFor = binding.originalKey;
  function decode(row: StoredUpload): UploadRecord<M, R> {
    return {
      uploadId: row.upload_id,
      assetId: row.asset_id,
      ownerSubject: row.owner_subject,
      originalKey: row.original_key,
      providerUploadId: row.provider_upload_id,
      state: row.state,
      phase: row.phase,
      file: fileSnapshot({
        fileName: row.file_name,
        size: Number(row.size),
        contentType: row.content_type,
        lastModified: Number(row.last_modified),
        sha256: row.sha256,
      }),
      metadata: snapshot(hooks.metadata, row.metadata).value,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      expiresAt: row.expires_at,
      dbNow: row.db_now,
      completeResponse:
        row.complete_response === null
          ? null
          : snapshot(hooks.response, row.complete_response).value,
      originalEtag: row.original_etag,
      failureCode: row.failure_code,
      cleanupNeeded: row.cleanup_needed,
    };
  }
  async function rows(tx: Tx, suffix: string, values: unknown[] = []) {
    return (
      await tx.query<StoredUpload>(
        `SELECT *,clock_timestamp() AS db_now FROM ${table} ${suffix}`,
        values,
      )
    ).rows.map(decode);
  }
  async function owned(tx: Tx, id: string, principal: UploadPrincipal, lock = false) {
    return (
      (
        await rows(tx, `WHERE upload_id=$1 AND owner_subject=$2 ${lock ? "FOR UPDATE" : ""}`, [
          uuid(id),
          subject(principal),
        ])
      )[0] ?? null
    );
  }
  async function terminal(tx: Tx, row: UploadRecord<M, R>, target: UploadTerminal) {
    await hooks.closed(tx, structuredClone(row), { ...target });
    await tx.query(
      `UPDATE ${table} SET state=$2,phase='closed',failure_code=$3,cleanup_needed=true,updated_at=clock_timestamp() WHERE upload_id=$1`,
      [row.uploadId, target.state, target.state === "failed" ? target.code : null],
    );
  }
  async function expire(tx: Tx, row: UploadRecord<M, R>) {
    if (row.expiresAt > row.dbNow) return false;
    await terminal(tx, row, { state: "expired" });
    return true;
  }
  return {
    reserve: (tx, principal, input) =>
      atomic(tx, async () => {
        const owner = subject(principal),
          parsed = hooks.validate(input, principal),
          file = fileSnapshot(parsed.file),
          metadata = snapshot(hooks.metadata, parsed.metadata),
          assetId = randomUUID(),
          uploadId = randomUUID(),
          originalKey = keyFor({ assetId, uploadId, file });
        if (
          typeof originalKey !== "string" ||
          !originalKey.length ||
          Buffer.byteLength(originalKey) > 1024 ||
          /[\x00-\x1f\x7f]/.test(originalKey)
        )
          throw new Error("Invalid original object key");
        const inserted = await tx.query<StoredUpload>(
          `INSERT INTO ${table}(upload_id,asset_id,owner_subject,original_key,file_name,size,content_type,last_modified,sha256,metadata) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *,clock_timestamp() AS db_now`,
          [
            uploadId,
            assetId,
            owner,
            originalKey,
            file.fileName,
            file.size,
            file.contentType,
            file.lastModified,
            file.sha256,
            metadata.json,
          ],
        );
        const row = decode(inserted.rows[0]!);
        await hooks.reserve(tx, structuredClone(row));
        return row;
      }),
    owned: (tx, id, principal, lock) => atomic(tx, () => owned(tx, id, principal, lock)),
    recent: (tx, principal) =>
      atomic(tx, () =>
        rows(tx, "WHERE owner_subject=$1 ORDER BY created_at DESC LIMIT 50", [subject(principal)]),
      ),
    saveProvider: (tx, id, principal, providerId) =>
      atomic(tx, async () => {
        if (typeof providerId !== "string" || !providerId.length || providerId.length > 2048)
          throw new Error("Invalid provider upload identity");
        const row = await owned(tx, id, principal, true);
        if (!row) return { outcome: "unknown" };
        if (row.state !== "uploading" || row.phase !== "initiating") return { outcome: "conflict" };
        if (await expire(tx, row)) return { outcome: "expired" };
        await tx.query(
          `UPDATE ${table} SET provider_upload_id=$2,phase='active',updated_at=clock_timestamp() WHERE upload_id=$1`,
          [row.uploadId, providerId],
        );
        return { outcome: "active" };
      }),
    beginComplete: (tx, id, principal) =>
      atomic(tx, async () => {
        const row = await owned(tx, id, principal, true);
        if (!row) return { outcome: "unknown", upload: null };
        if (row.completeResponse !== null) return { outcome: "duplicate", upload: row };
        if (row.state !== "uploading" || !["active", "completing"].includes(row.phase))
          return { outcome: "conflict", upload: row };
        if (await expire(tx, row)) return { outcome: "expired", upload: row };
        await tx.query(
          `UPDATE ${table} SET phase='completing',updated_at=clock_timestamp() WHERE upload_id=$1`,
          [row.uploadId],
        );
        return { outcome: "completing", upload: { ...row, phase: "completing" } };
      }),
    complete: (tx, id, principal, original) =>
      atomic(tx, async () => {
        const row = await owned(tx, id, principal, true);
        if (!row) return { outcome: "unknown" };
        if (row.completeResponse !== null)
          return { outcome: "duplicate", response: row.completeResponse };
        if (row.state !== "uploading" || row.phase !== "completing") return { outcome: "conflict" };
        if (await expire(tx, row)) return { outcome: "expired" };
        if (
          original.key !== row.originalKey ||
          original.size !== row.file.size ||
          original.sha256 !== row.file.sha256 ||
          typeof original.etag !== "string" ||
          !original.etag.length ||
          original.etag.length > 1024
        )
          return { outcome: "mismatch" };
        const response = snapshot(
          hooks.response,
          await hooks.complete(tx, structuredClone(row), { ...original }),
        );
        await tx.query(
          `UPDATE ${table} SET state='completed',phase='closed',complete_response=$2,original_etag=$3,updated_at=clock_timestamp() WHERE upload_id=$1`,
          [row.uploadId, response.json, original.etag],
        );
        return { outcome: "completed", response: response.value };
      }),
    close: (tx, id, principal, target) =>
      atomic(tx, async () => {
        if (target !== "aborted" && target !== "expired")
          throw new Error("Invalid upload terminal state");
        const row = await owned(tx, id, principal, true);
        if (!row) return { outcome: "unknown" };
        if (row.state !== "uploading") return { outcome: row.state };
        const state = row.expiresAt <= row.dbNow ? "expired" : target;
        if (state === "expired" && row.expiresAt > row.dbNow) return { outcome: "not-due" };
        await terminal(tx, row, { state });
        return { outcome: state };
      }),
    fail: (tx, id, principal, code) =>
      atomic(tx, async () => {
        if (code !== "INITIATION_FAILED" && code !== "UPLOAD_MISMATCH")
          throw new Error("Invalid upload failure code");
        const row = await owned(tx, id, principal, true);
        if (!row || row.state !== "uploading") return false;
        await terminal(tx, row, { state: "failed", code });
        return true;
      }),
    reopenIncomplete: (tx, id, principal) =>
      atomic(tx, async () => {
        const row = await owned(tx, id, principal, true);
        if (row?.state === "uploading" && row.phase === "completing" && row.expiresAt > row.dbNow)
          await tx.query(
            `UPDATE ${table} SET phase='active',updated_at=clock_timestamp() WHERE upload_id=$1`,
            [row.uploadId],
          );
      }),
    cleanup: (tx) =>
      atomic(tx, () =>
        rows(
          tx,
          "WHERE cleanup_needed OR (state='uploading' AND expires_at<=clock_timestamp()) ORDER BY expires_at LIMIT 50",
        ),
      ),
    interrupted: (tx) =>
      atomic(tx, () =>
        rows(
          tx,
          "WHERE state='uploading' AND (phase='completing' OR (phase='initiating' AND created_at<clock_timestamp()-interval '1 minute')) ORDER BY created_at LIMIT 50",
        ),
      ),
    clearCleanup: (tx, id) =>
      atomic(tx, async () => {
        await tx.query(
          `UPDATE ${table} SET cleanup_needed=false WHERE upload_id=$1 AND phase='closed'`,
          [uuid(id)],
        );
      }),
  };
}

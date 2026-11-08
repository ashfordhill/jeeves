import {
  AbortMultipartUploadCommand,
  CompleteMultipartUploadCommand,
  CreateMultipartUploadCommand,
  HeadObjectCommand,
  ListMultipartUploadsCommand,
  ListPartsCommand,
  type S3Client,
} from "@aws-sdk/client-s3";
import type { MultipartObjects } from "./multipart.ts";
import { signPart } from "./objects.ts";

/** Explicit key namespace and metadata names permit product adapters to preserve existing
 * object identity without embedding any product contract in the transport. Clients are owned
 * and destroyed by the caller; signing can use a distinct externally reachable endpoint. */
export function createMultipartObjects<M, R>(options: {
  control: S3Client;
  signing: S3Client;
  bucket: string;
  prefix: string;
  ownsKey(key: string): boolean;
  metadata: { assetId: string; uploadId: string; sha256: string; expectedSize: string };
}): MultipartObjects<M, R> {
  if (!options.bucket || !options.prefix || /[\x00-\x1f\x7f]/.test(options.prefix))
    throw new Error("Bind a bucket and nonempty multipart namespace");
  const names = Object.values(options.metadata);
  if (new Set(names).size !== 4 || names.some((n) => !/^[a-z][a-z0-9-]{0,63}$/.test(n)))
    throw new Error("Bind four distinct lower-case metadata names");
  const { control, signing, bucket, prefix, metadata } = options;
  const ownsKey = (key: string) => key.startsWith(prefix) && options.ownsKey(key);
  const bound = (key: string) => {
    if (!ownsKey(key)) throw new Error("Object outside multipart namespace");
    return { Bucket: bucket, Key: key };
  };
  const signal = () => ({ abortSignal: AbortSignal.timeout(4000) });
  return {
    ownsKey,
    missing: (error) => ["NoSuchUpload", "NotFound", "NoSuchKey"].includes((error as Error)?.name),
    async create(r) {
      const result = await control.send(
        new CreateMultipartUploadCommand({
          ...bound(r.originalKey),
          ContentType: r.file.contentType,
          Metadata: {
            [metadata.assetId]: r.assetId,
            [metadata.uploadId]: r.uploadId,
            [metadata.sha256]: r.file.sha256,
            [metadata.expectedSize]: String(r.file.size),
          },
        }),
        signal(),
      );
      if (!result.UploadId) throw new Error("Missing multipart identity");
      return result.UploadId;
    },
    sign: (r, partNumber, seconds) => {
      bound(r.originalKey);
      return signPart(signing, {
        bucket,
        key: r.originalKey,
        uploadId: r.providerUploadId!,
        partNumber,
        expiresInSeconds: seconds,
      });
    },
    async parts(r, marker) {
      const result = await control.send(
        new ListPartsCommand({
          ...bound(r.originalKey),
          UploadId: r.providerUploadId!,
          PartNumberMarker: marker,
          MaxParts: 100,
        }),
        signal(),
      );
      return {
        parts: (result.Parts ?? []).map((p) => ({
          partNumber: p.PartNumber!,
          size: p.Size!,
          etag: p.ETag!,
        })),
        truncated: result.IsTruncated ?? false,
        next: result.NextPartNumberMarker,
      };
    },
    async complete(r, parts) {
      await control.send(
        new CompleteMultipartUploadCommand({
          ...bound(r.originalKey),
          UploadId: r.providerUploadId!,
          MultipartUpload: {
            Parts: parts.map((p) => ({ PartNumber: p.partNumber, ETag: p.etag })),
          },
        }),
        signal(),
      );
    },
    async head(r) {
      const h = await control.send(new HeadObjectCommand(bound(r.originalKey)), signal());
      return {
        size: h.ContentLength,
        etag: h.ETag,
        assetId: h.Metadata?.[metadata.assetId],
        uploadId: h.Metadata?.[metadata.uploadId],
        sha256: h.Metadata?.[metadata.sha256],
        expectedSize: h.Metadata?.[metadata.expectedSize],
      };
    },
    async abort(key, providerUploadId) {
      await control.send(
        new AbortMultipartUploadCommand({
          ...bound(key),
          UploadId: providerUploadId,
        }),
        signal(),
      );
    },
    async unfinished(cursor) {
      const result = await control.send(
        new ListMultipartUploadsCommand({
          Bucket: bucket,
          Prefix: prefix,
          MaxUploads: 50,
          KeyMarker: cursor.key,
          UploadIdMarker: cursor.uploadId,
        }),
        signal(),
      );
      return {
        uploads: (result.Uploads ?? []).flatMap((u) =>
          u.Key && u.UploadId && u.Initiated
            ? [{ key: u.Key, uploadId: u.UploadId, initiated: u.Initiated }]
            : [],
        ),
        next: result.IsTruncated
          ? { key: result.NextKeyMarker, uploadId: result.NextUploadIdMarker }
          : {},
      };
    },
  };
}

import { createReadStream } from "node:fs";
import { lstat } from "node:fs/promises";
import type { Readable } from "node:stream";
import {
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  type S3Client,
} from "@aws-sdk/client-s3";
import { InvalidMedia } from "./media-process.ts";
import type { MediaObjects } from "./media-worker.ts";
import { bindVideoMarker, videoHlsJob, type VideoHlsJob } from "./video-result.ts";

interface ObjectBinding {
  client: S3Client;
  bucket: string;
  /** Trusted adapter checks the complete authoritative job source/result namespace. */
  owns(job: VideoHlsJob): boolean;
}
/** Owns/destroys both injected clients (once when shared). No global provider configuration,
 * listing, SQL, remote deletion, ACL or atomic multi-object publication is implied. */
export function createMediaObjects(options: {
  source: ObjectBinding;
  results: ObjectBinding;
  sha256Metadata: string;
}): MediaObjects {
  if (
    !options.source.bucket ||
    !options.results.bucket ||
    !/^[a-z][a-z0-9-]{0,63}$/.test(options.sha256Metadata)
  )
    throw new Error("Bind media buckets and SHA metadata name");
  const bound = (binding: ObjectBinding, input: VideoHlsJob, key: string) => {
    const job = videoHlsJob.parse(input);
    if (!binding.owns(job)) throw new Error("Media object outside bound namespace");
    return { Bucket: binding.bucket, Key: key };
  };
  return {
    async source(job, signal) {
      const result = await options.source.client.send(
        new GetObjectCommand(bound(options.source, job, job.source.key)),
        { abortSignal: signal },
      );
      if (!result.Body) throw new InvalidMedia();
      return { body: result.Body as Readable, size: result.ContentLength };
    },
    async marker(job, signal) {
      let result;
      try {
        result = await options.results.client.send(
          new GetObjectCommand(bound(options.results, job, job.resultPrefix + "_complete.json")),
          { abortSignal: signal },
        );
      } catch (error) {
        if (
          (error as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode === 404
        )
          return null;
        throw error;
      }
      const body = result.Body as Readable | undefined;
      try {
        if (
          !body ||
          !result.ContentLength ||
          result.ContentLength > 262144 ||
          result.ContentType !== "application/json"
        )
          throw new Error("Invalid media marker size or type");
        let size = 0;
        const chunks: Buffer[] = [];
        for await (const chunk of body) {
          signal.throwIfAborted();
          const buffer = Buffer.from(chunk);
          size += buffer.length;
          if (size > 262144 || size > result.ContentLength)
            throw new Error("Media marker exceeds bound");
          chunks.push(buffer);
        }
        if (size !== result.ContentLength) throw new Error("Truncated media marker");
        return JSON.parse(Buffer.concat(chunks).toString("utf8"));
      } finally {
        body?.destroy();
      }
    },
    async head(job, entry, signal) {
      const result = await options.results.client.send(
        new HeadObjectCommand(bound(options.results, job, job.resultPrefix + entry.path)),
        { abortSignal: signal },
      );
      return {
        size: result.ContentLength,
        sha256: result.Metadata?.[options.sha256Metadata],
        contentType: result.ContentType,
      };
    },
    async put(job, entry, file, signal) {
      const stat = await lstat(file);
      if (!stat.isFile() || stat.size !== entry.size)
        throw new Error("Local media inventory mismatch");
      const body = createReadStream(file);
      try {
        await options.results.client.send(
          new PutObjectCommand({
            ...bound(options.results, job, job.resultPrefix + entry.path),
            Body: body,
            ContentLength: entry.size,
            ContentType: entry.contentType,
            Metadata: { [options.sha256Metadata]: entry.sha256 },
            CacheControl: entry.path.endsWith(".m3u8")
              ? "public, max-age=60"
              : "public, max-age=31536000, immutable",
          }),
          { abortSignal: signal },
        );
      } finally {
        body.destroy();
      }
    },
    async complete(job, raw, signal) {
      const marker = bindVideoMarker(raw, job),
        body = Buffer.from(JSON.stringify(marker));
      if (body.length > 262144) throw new Error("Media marker exceeds bound");
      await options.results.client.send(
        new PutObjectCommand({
          ...bound(options.results, job, marker.result.marker),
          Body: body,
          ContentLength: body.length,
          ContentType: "application/json",
          CacheControl: "public, max-age=31536000, immutable",
        }),
        { abortSignal: signal },
      );
    },
    close() {
      const errors: unknown[] = [];
      for (const client of new Set([options.source.client, options.results.client])) {
        try {
          client.destroy();
        } catch (error) {
          errors.push(error);
        }
      }
      if (errors.length) throw new AggregateError(errors, "Media object clients failed to close");
    },
  };
}

import { createHash } from "node:crypto";
import { createWriteStream } from "node:fs";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Transform, type Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { GetObjectCommand, HeadObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { connect as consumer } from "../clients/transcoder-consumer.ts";
import { connect as publisher } from "../clients/transcoder-done.ts";
import {
  logicalEventId,
  parseMessage,
  processingEvent,
  processingRequested,
  resultPrefix,
  type ProcessingRequested,
  type ProcessingEvent,
} from "../contracts/v1.ts";
import { handle as encode } from "../extensions/transcoder-encoder.ts";
import {
  bindMarker,
  handle as packageMedia,
  type CompletionMarker,
} from "../extensions/transcoder-packager.ts";
import { handle as thumbnail } from "../extensions/transcoder-thumbnails.ts";
import { NonRetryable, type Delivery } from "../lib/amqp.ts";
import { objects } from "../lib/objects.ts";
import { run } from "../lib/media.ts";
const s3 = objects(),
  bucket = "youtube-v1-transcoded",
  abort = new AbortController();
const done = await publisher();
function jobMessage(body: Buffer, delivery: Delivery): ProcessingRequested {
  try {
    if (!delivery.messageId) throw new Error("Missing message ID");
    return processingRequested.parse(parseMessage("upload-jobs", body, delivery.messageId));
  } catch {
    throw new NonRetryable("MALFORMED_MESSAGE");
  }
}
async function emit(
  job: ProcessingRequested,
  type: ProcessingEvent["type"],
  extra: Record<string, unknown> = {},
) {
  const event = processingEvent.parse({
    schemaVersion: 1,
    eventId: logicalEventId(job.jobId, job.attemptId, type),
    occurredAt: new Date().toISOString(),
    videoId: job.videoId,
    jobId: job.jobId,
    attemptId: job.attemptId,
    type,
    ...extra,
  });
  await done.publish(Buffer.from(JSON.stringify(event)), event.eventId);
}
function missing(e: unknown) {
  return (e as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode === 404;
}
async function marker(
  job: ProcessingRequested,
  signal: AbortSignal,
): Promise<CompletionMarker | null> {
  let object;
  try {
    object = await s3.send(
      new GetObjectCommand({
        Bucket: bucket,
        Key: resultPrefix(job.videoId, job.jobId, job.attemptId) + "_complete.json",
      }),
      { abortSignal: signal },
    );
  } catch (e) {
    if (missing(e)) return null;
    throw e;
  }
  if (!object.Body || !object.ContentLength || object.ContentLength > 256 * 1024) {
    object.Body?.transformToWebStream().cancel();
    throw new Error("Invalid marker size");
  }
  let size = 0;
  const chunks: Buffer[] = [];
  for await (const chunk of object.Body as Readable) {
    const b = Buffer.from(chunk);
    size += b.length;
    if (size > 256 * 1024) throw new Error("Marker exceeds bound");
    chunks.push(b);
  }
  const m = bindMarker(JSON.parse(Buffer.concat(chunks).toString("utf8")), job);
  for (const entry of m.inventory) {
    const h = await s3.send(
      new HeadObjectCommand({ Bucket: bucket, Key: m.result.prefix + entry.path }),
      { abortSignal: signal },
    );
    if (
      h.ContentLength !== entry.size ||
      h.Metadata?.sha256 !== entry.sha256 ||
      h.ContentType !== entry.contentType
    )
      throw new Error("Completed inventory mismatch");
  }
  return m;
}
async function handle(body: Buffer, delivery: Delivery) {
  const job = jobMessage(body, delivery),
    signal = AbortSignal.any([abort.signal, AbortSignal.timeout(1200000)]);
  // A single configured worker serializes this immutable namespace. A durable complete marker
  // re-emits the same logical result without downloading/re-encoding or rewriting any output.
  const completed = await marker(job, signal);
  if (completed) {
    await emit(job, "ProcessingSucceeded", { result: completed.result });
    console.log(
      JSON.stringify({ videoId: job.videoId, jobId: job.jobId, outcome: "marker-reused" }),
    );
    return;
  }
  await emit(job, "ProcessingStarted");
  const dir = await mkdtemp(join(tmpdir(), "youtube-encode-"));
  try {
    const input = join(dir, "source.mp4"),
      output = join(dir, "output");
    await mkdir(output);
    const original = await s3.send(
      new GetObjectCommand({ Bucket: "youtube-v1-originals", Key: job.originalKey }),
      { abortSignal: signal },
    );
    if (!original.Body || original.ContentLength !== job.expectedSize) {
      (original.Body as Readable | undefined)?.destroy();
      throw new NonRetryable("INVALID_MEDIA");
    }
    const hash = createHash("sha256");
    let size = 0;
    await pipeline(
      original.Body as Readable,
      new Transform({
        transform(chunk: Buffer, _encoding, callback) {
          size += chunk.length;
          if (size > job.expectedSize) callback(new NonRetryable("INVALID_MEDIA"));
          else {
            hash.update(chunk);
            callback(null, chunk);
          }
        },
      }),
      createWriteStream(input, { flags: "wx" }),
      { signal },
    );
    if (size !== job.expectedSize || hash.digest("hex") !== job.expectedSha256)
      throw new NonRetryable("INVALID_MEDIA");
    const source = await encode(input, output, signal);
    await thumbnail(input, output, source, signal);
    const m = await packageMedia(output, job, source.duration);
    // Segments precede playlists; master and the final marker are written last.
    const order = [...m.inventory].sort(
      (a, b) => rank(a.path) - rank(b.path) || a.path.localeCompare(b.path),
    );
    for (const entry of order)
      await s3.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: m.result.prefix + entry.path,
          Body: await readFile(join(output, entry.path)),
          ContentType: entry.contentType,
          Metadata: { sha256: entry.sha256 },
          CacheControl: entry.path.endsWith(".m3u8")
            ? "public, max-age=60"
            : "public, max-age=31536000, immutable",
        }),
        { abortSignal: signal },
      );
    await s3.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: m.result.marker,
        Body: JSON.stringify(m),
        ContentType: "application/json",
        CacheControl: "public, max-age=31536000, immutable",
      }),
      { abortSignal: signal },
    );
    const verified = await marker(job, signal);
    if (!verified) throw new Error("Missing completion marker");
    await emit(job, "ProcessingSucceeded", { result: verified.result });
    console.log(
      JSON.stringify({
        videoId: job.videoId,
        jobId: job.jobId,
        outcome: "completed",
        inventory: m.inventory,
      }),
    );
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
function rank(path: string) {
  return path.endsWith(".ts")
    ? 0
    : path.includes("/index.m3u8")
      ? 1
      : path === "thumbnail.jpg"
        ? 2
        : 3;
}
let input: Awaited<ReturnType<typeof consumer>> | undefined;
let stopping: Promise<void> | undefined;
function close() {
  return (stopping ??= (async () => {
    await rm("/tmp/shell-ready", { force: true });
    await input?.close();
    await done.close();
    s3.destroy();
  })());
}
try {
  await rm("/tmp/shell-ready", { force: true });
  await run("ffmpeg", ["-version"], abort.signal, 30000);
  input = await consumer(handle, {
    onFatal: () => abort.abort(),
    onTerminal: async (body, delivery, error) => {
      let job;
      try {
        job = jobMessage(body, delivery);
      } catch {
        return;
      }
      await emit(job, "ProcessingFailed", {
        code:
          error instanceof NonRetryable && error.code === "INVALID_MEDIA"
            ? "INVALID_MEDIA"
            : "PROCESSING_FAILED",
      });
    },
  });
  await writeFile("/tmp/shell-ready", "ready\n");
  const publicationLost = done.closed.then(async (r) => {
    if (r.fatal) {
      abort.abort();
      await input?.close();
    }
    return r;
  });
  const result = await Promise.race([input.closed, publicationLost]);
  if (result.fatal) process.exitCode = 1;
  await close();
} catch {
  console.error("Transcoder stopped; inspect media/provider readiness.");
  process.exitCode = 1;
  abort.abort();
  await close();
}

import { createHash } from "node:crypto";
import { createWriteStream } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Transform, type Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { NonRetryable, type ConsumerHooks, type MessageHandler } from "./delivery.ts";
import { InvalidMedia, localMediaPath } from "./media-process.ts";
import { encodeVideoHls, type VideoHlsInput } from "./video-hls.ts";
import {
  bindVideoMarker,
  bindVideoResult,
  videoHlsJob,
  type VideoCompletionMarker,
  type VideoHlsJob,
} from "./video-result.ts";

export type MediaFailure = "INVALID_MEDIA" | "PROCESSING_FAILED";
export type MediaEvent<R> =
  | { kind: "started" }
  | { kind: "succeeded"; result: R }
  | { kind: "failed"; code: MediaFailure };
export type MediaInventoryEntry = VideoCompletionMarker["inventory"][number];
export interface MediaObjects {
  source(job: VideoHlsJob, signal: AbortSignal): Promise<{ body: Readable; size?: number }>;
  marker(job: VideoHlsJob, signal: AbortSignal): Promise<unknown | null>;
  head(
    job: VideoHlsJob,
    entry: MediaInventoryEntry,
    signal: AbortSignal,
  ): Promise<{
    size?: number;
    sha256?: string;
    contentType?: string;
  }>;
  put(
    job: VideoHlsJob,
    entry: MediaInventoryEntry,
    file: string,
    signal: AbortSignal,
  ): Promise<void>;
  complete(job: VideoHlsJob, marker: VideoCompletionMarker, signal: AbortSignal): Promise<void>;
  close(): void | Promise<void>;
}
export interface MediaTransport {
  closed: Promise<{ fatal: boolean }>;
  close(): Promise<void>;
}
export interface MediaPublisher extends MediaTransport {
  /** Must resolve only after broker persistence confirmation. */
  publish(body: Uint8Array, messageId: string): Promise<void>;
}
export interface MediaCodecs<J, R> {
  /** Decode original wire and bind its transport identity. Never receives normalized data. */
  job(raw: unknown, messageId: string): J;
  /** Derive/check authoritative source key and immutable result prefix, not client paths. */
  video(job: J): VideoHlsJob;
  result(raw: unknown, job: J): R;
  /** Stable logical identity for each kind; independent of retry and occurredAt. */
  eventId(job: J, kind: MediaEvent<R>["kind"]): string;
  /** Construct AND validate the application's actual wire envelope. */
  event(job: J, event: MediaEvent<R> & { eventId: string; occurredAt: string }): unknown;
}
function messageId(value: unknown): string {
  if (typeof value !== "string" || !value || value.length > 200 || /[\x00-\x20\x7f]/.test(value))
    throw new Error("Invalid media message identity");
  return value;
}
function jsonBody(value: unknown): Buffer {
  const json = JSON.stringify(value);
  if (!json) throw new Error("Invalid media event");
  const body = Buffer.from(json);
  if (body.byteLength > 65536) throw new Error("Media event exceeds bound");
  return body;
}
export function mediaUploadRank(path: string): number {
  return path.endsWith(".ts")
    ? 0
    : path.includes("/index.m3u8")
      ? 1
      : path === "thumbnail.jpg"
        ? 2
        : 3;
}
/** A complete marker binds every identity/fingerprint/path before checking the actual remote
 * inventory. SHA is provider metadata here; source download and local engine hash actual bytes. */
export async function reuseMediaMarker(
  objects: MediaObjects,
  job: VideoHlsJob,
  signal: AbortSignal,
) {
  signal.throwIfAborted();
  const raw = await objects.marker(job, signal);
  if (raw === null) return null;
  const marker = bindVideoMarker(raw, job);
  for (const entry of marker.inventory) {
    signal.throwIfAborted();
    const head = await objects.head(job, entry, signal);
    if (
      head.size !== entry.size ||
      head.sha256 !== entry.sha256 ||
      head.contentType !== entry.contentType
    )
      throw new Error("Completed media inventory mismatch");
  }
  return marker;
}
export async function downloadMediaSource(
  objects: MediaObjects,
  job: VideoHlsJob,
  file: string,
  signal: AbortSignal,
) {
  signal.throwIfAborted();
  const source = await objects.source(job, signal);
  if (!source.body || source.size !== job.source.size) {
    source.body?.destroy();
    throw new InvalidMedia();
  }
  const hash = createHash("sha256");
  let size = 0;
  await pipeline(
    source.body,
    new Transform({
      transform(chunk: Buffer, _encoding, callback) {
        size += chunk.length;
        if (size > job.source.size) callback(new InvalidMedia());
        else {
          hash.update(chunk);
          callback(null, chunk);
        }
      },
    }),
    createWriteStream(localMediaPath(file), { flags: "wx" }),
    { signal },
  );
  if (size !== job.source.size || hash.digest("hex") !== job.source.sha256)
    throw new InvalidMedia();
}

/** Exactly one configured worker/prefetch1 serializes immutable namespaces. This is not a
 * distributed lock, multi-object transaction or ACL boundary. Objects/transports opened here
 * are owned and closed here. Normal close drains bounded work; fatal transport loss aborts it. */
export async function startMediaWorker<J, R>(options: {
  codecs: MediaCodecs<J, R>;
  objects: MediaObjects;
  openPublisher(hooks: Pick<ConsumerHooks, "onFatal">): Promise<MediaPublisher>;
  openConsumer(
    options: ConsumerHooks & { concurrency: 1; handle: MessageHandler },
  ): Promise<MediaTransport>;
  engine?: (input: VideoHlsInput) => Promise<VideoCompletionMarker>;
  tempRoot?: string;
  onFatal?: (error: unknown) => void;
}) {
  const abort = new AbortController();
  let input: MediaTransport | undefined, publisher: MediaPublisher | undefined;
  let stopping = false,
    fatal = false,
    closing: Promise<void> | undefined;
  let finish!: (result: { fatal: boolean }) => void;
  const closed = new Promise<{ fatal: boolean }>((resolve) => {
    finish = resolve;
  });
  function fail(error: unknown) {
    if (!fatal) {
      fatal = true;
      abort.abort(new Error("Media worker unavailable"));
      try {
        options.onFatal?.(error);
      } catch {
        /* Notification cannot prevent drain. */
      }
    }
    // The current delivery may itself be in the consumer drain. Never await here.
    void close();
  }
  function close(): Promise<void> {
    if (closing) return closing;
    stopping = true;
    return (closing = (async () => {
      for (const drain of [
        () => input?.close(),
        () => publisher?.close(),
        () => options.objects.close(),
      ]) {
        try {
          await drain();
        } catch (error) {
          fatal = true;
          abort.abort(error);
        }
      }
      finish({ fatal });
    })());
  }
  function decode(body: Buffer, id: string | undefined) {
    try {
      if (!body.byteLength || body.byteLength > 65536) throw new Error("Invalid media envelope");
      const job = options.codecs.job(JSON.parse(body.toString("utf8")), messageId(id));
      return { job, video: videoHlsJob.parse(options.codecs.video(job)) };
    } catch {
      throw new NonRetryable("MALFORMED_MESSAGE");
    }
  }
  async function emit(job: J, event: MediaEvent<R>) {
    const id = messageId(options.codecs.eventId(job, event.kind));
    const wire = options.codecs.event(job, {
      ...event,
      eventId: id,
      occurredAt: new Date().toISOString(),
    });
    if (!publisher) throw new Error("Media publisher unavailable");
    await publisher.publish(jsonBody(wire), id);
  }
  const handle: MessageHandler = async (body, delivery) => {
    const { job, video } = decode(body, delivery.messageId);
    const deadline = new AbortController();
    const timer = setTimeout(() => deadline.abort(new Error("Media execution deadline")), 1200000);
    const signal = AbortSignal.any([abort.signal, deadline.signal]);
    try {
      signal.throwIfAborted();
      const completed = await reuseMediaMarker(options.objects, video, signal);
      if (completed) {
        signal.throwIfAborted();
        await emit(job, {
          kind: "succeeded",
          result: options.codecs.result(completed.result, job),
        });
        return;
      }
      await emit(job, { kind: "started" });
      signal.throwIfAborted();
      const dir = await mkdtemp(join(localMediaPath(options.tempRoot ?? tmpdir()), "media-job-"));
      try {
        const source = join(dir, "source.mp4"),
          output = join(dir, "output");
        // The fixed engine owns exclusive creation of output. Create only the workspace.
        await downloadMediaSource(options.objects, video, source, signal);
        const marker = bindVideoMarker(
          await (options.engine ?? encodeVideoHls)({
            input: source,
            output,
            job: video,
            signal,
          }),
          video,
        );
        const order = [...marker.inventory].sort(
          (a, b) =>
            mediaUploadRank(a.path) - mediaUploadRank(b.path) ||
            (a.path < b.path ? -1 : a.path > b.path ? 1 : 0),
        );
        for (const entry of order) {
          signal.throwIfAborted();
          await options.objects.put(video, entry, join(output, entry.path), signal);
        }
        signal.throwIfAborted();
        await options.objects.complete(video, marker, signal);
        const verified = await reuseMediaMarker(options.objects, video, signal);
        if (!verified) throw new Error("Missing media completion marker");
        const result = bindVideoResult(verified.result, video.resultPrefix);
        signal.throwIfAborted();
        await emit(job, {
          kind: "succeeded",
          result: options.codecs.result(result, job),
        });
      } finally {
        await rm(dir, { recursive: true, force: true });
      }
    } catch (error) {
      if (error instanceof InvalidMedia) throw new NonRetryable("INVALID_MEDIA");
      throw error;
    } finally {
      clearTimeout(timer);
    }
  };
  try {
    publisher = await options.openPublisher({ onFatal: fail });
    void publisher.closed.then((result) => {
      if (!stopping) {
        if (result.fatal) fail(new Error("Media publisher closed"));
        else void close();
      }
    });
    if (stopping) throw new Error("Media worker stopped during startup");
    input = await options.openConsumer({
      concurrency: 1,
      handle,
      onFatal: fail,
      async onTerminal(body, delivery, error) {
        let job: J;
        try {
          job = decode(body, delivery.messageId).job;
        } catch {
          return;
        }
        if (abort.signal.aborted) throw abort.signal.reason;
        await emit(job, {
          kind: "failed",
          code:
            error instanceof NonRetryable && error.code === "INVALID_MEDIA"
              ? "INVALID_MEDIA"
              : "PROCESSING_FAILED",
        });
      },
    });
    void input.closed.then((result) => {
      if (!stopping) {
        if (result.fatal) fail(new Error("Media consumer closed"));
        else void close();
      }
    });
    if (stopping) throw new Error("Media worker stopped during startup");
    return { close, closed };
  } catch (error) {
    fail(error);
    await close();
    // A transport may finish opening after a synchronous fatal callback initiated close.
    await Promise.allSettled([input?.close(), publisher?.close()]);
    throw error;
  }
}

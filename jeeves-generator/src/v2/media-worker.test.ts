import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { stripTypeScriptTypes } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Readable } from "node:stream";
import { designSchema } from "@jeeves/spec";
import { describe, expect, it } from "vitest";
import {
  generationSelectionsFixture,
  generationSourceFixture,
} from "../../../jeeves/packages/spec/src/fixtures/yv2-selections.ts";
import { loadLocalV2Registry } from "../../templates/local-v2/index.ts";
import { assembleV2 } from "./assemble.ts";

// Execute exact emitted source, with offline streams and transports. No SDK, Docker or FFmpeg.
const urls = new Map<string, string>();
function moduleUrl(name: string): string {
  const previous = urls.get(name);
  if (previous) return previous;
  const js = stripTypeScriptTypes(
    readFileSync(
      new URL(`../../templates/local-v2/assets/src/runtime/${name}.ts.template`, import.meta.url),
      "utf8",
    ),
  )
    .replace(/from "\.\/(.+)\.ts"/g, (_match, dep: string) => `from "${moduleUrl(dep)}"`)
    .replace('from "zod"', `from "${import.meta.resolve("zod")}"`);
  const url = `data:text/javascript;base64,${Buffer.from(js).toString("base64")}`;
  urls.set(name, url);
  return url;
}
const { startMediaWorker } = await import(moduleUrl("media-worker"));
const { createDeliveryRunner } = await import(moduleUrl("delivery"));
const sha = (value: string) => createHash("sha256").update(value).digest("hex");
const video = {
  assetId: "12345678-1234-5678-9012-345678901234",
  jobId: "22345678-1234-5678-9012-345678901234",
  attemptId: "32345678-1234-5678-9012-345678901234",
  source: { key: "attachments/raw/clip.mp4", size: 8, sha256: sha("original") },
  resultPrefix: "attachments/render/attempt/",
};
const wire = { document: "course-clip", request: "request-1", media: video };
const marker = () => ({
  schemaVersion: 1,
  assetId: video.assetId,
  jobId: video.jobId,
  attemptId: video.attemptId,
  source: video.source,
  result: {
    prefix: video.resultPrefix,
    manifest: `${video.resultPrefix}master.m3u8`,
    thumbnail: `${video.resultPrefix}thumbnail.jpg`,
    marker: `${video.resultPrefix}_complete.json`,
    durationSeconds: 20,
    renditions: [360, 720].map((height) => ({
      height,
      width: height === 360 ? 640 : 1280,
      playlist: `${video.resultPrefix}${height}/index.m3u8`,
      videoCodec: "h264",
      audioCodec: "aac",
    })),
  },
  // Intentionally unordered. Runner owns upload ordering.
  inventory: [
    "master.m3u8",
    "thumbnail.jpg",
    "720/index.m3u8",
    "720/segment00000.ts",
    "360/index.m3u8",
    "360/segment00000.ts",
  ].map((path) => ({
    path,
    size: 1,
    sha256: sha("x"),
    contentType: path.endsWith(".ts")
      ? "video/mp2t"
      : path.endsWith(".jpg")
        ? "image/jpeg"
        : "application/vnd.apple.mpegurl",
  })),
});
async function fixture(
  options: { badHash?: boolean; waitEngine?: boolean; closeFailure?: boolean } = {},
) {
  const root = await mkdtemp(join(tmpdir(), "jeeves-media-test-"));
  const events: { id: string; body: { signal: string; payload: unknown } }[] = [];
  const writes: string[] = [],
    closes: string[] = [],
    deadLetters: string[] = [];
  let current: ReturnType<typeof marker> | null = null,
    sourceReads = 0,
    encodes = 0,
    acks = 0;
  let decodeCount = 0,
    mismatch = false,
    fatalHook: (e: Error) => void = () => {};
  let engineEntered!: () => void;
  const entered = new Promise<void>((r) => {
    engineEntered = r;
  });
  let runner: ReturnType<typeof createDeliveryRunner>;
  const objects = {
    async source() {
      sourceReads++;
      return { size: 8, body: Readable.from([options.badHash ? "tampered" : "original"]) };
    },
    async marker() {
      return current;
    },
    async head(_job: unknown, entry: { size: number; sha256: string; contentType: string }) {
      return { ...entry, ...(mismatch ? { sha256: sha("wrong") } : {}) };
    },
    async put(_job: unknown, entry: { path: string }, file: string) {
      expect(await readFile(file, "utf8")).toBe("x");
      writes.push(entry.path);
    },
    async complete(_job: unknown, value: ReturnType<typeof marker>) {
      writes.push("_complete.json");
      current = value;
    },
    close() {
      closes.push("objects");
    },
  };
  const worker = await startMediaWorker({
    tempRoot: root,
    objects,
    codecs: {
      job(raw: typeof wire, id: string) {
        decodeCount++;
        if (raw.document !== "course-clip" || raw.request !== id || !raw.media)
          throw new Error("Invalid document envelope");
        return { document: raw.document, video: raw.media };
      },
      video(job: { video: typeof video }) {
        return job.video;
      },
      result(raw: ReturnType<typeof marker>["result"]) {
        return { attachmentManifest: raw.manifest };
      },
      eventId(_job: unknown, kind: string) {
        return `course-clip:${kind}`;
      },
      event(
        job: { document: string },
        event: {
          eventId: string;
          occurredAt: string;
          kind: string;
          result?: unknown;
          code?: string;
        },
      ) {
        return {
          attachment: job.document,
          signal: event.kind,
          id: event.eventId,
          at: event.occurredAt,
          payload: event.result ?? event.code ?? null,
        };
      },
    },
    async engine({
      input,
      output,
      signal,
    }: {
      input: string;
      output: string;
      signal: AbortSignal;
    }) {
      encodes++;
      expect(await readFile(input, "utf8")).toBe("original");
      expect(await readdir(root)).toHaveLength(1);
      await mkdir(output); // Exclusive engine output creation must succeed.
      engineEntered();
      if (options.waitEngine)
        await new Promise((_resolve, reject) =>
          signal.addEventListener("abort", () => reject(signal.reason), { once: true }),
        );
      const value = marker();
      await Promise.all(["360", "720"].map((path) => mkdir(join(output, path))));
      await Promise.all(value.inventory.map((entry) => writeFile(join(output, entry.path), "x")));
      return value;
    },
    async openPublisher() {
      return {
        closed: new Promise(() => {}),
        async close() {
          closes.push("publisher");
          if (options.closeFailure) throw new Error("Publisher close failed");
        },
        async publish(body: Buffer, id: string) {
          events.push({ id, body: JSON.parse(body.toString()) });
        },
      };
    },
    async openConsumer(config: {
      concurrency: number;
      handle: unknown;
      onFatal: (error: Error) => void;
    }) {
      expect(config.concurrency).toBe(1);
      fatalHook = config.onFatal;
      runner = createDeliveryRunner({
        ...config,
        queue: "attachment-jobs",
        failedQueue: "attachment-jobs.failed",
        retryLimit: 0,
        transport: {
          async cancel() {
            closes.push("cancel");
          },
          async close() {
            closes.push("consumer");
          },
          async republish(destination: string) {
            deadLetters.push(destination);
          },
          ack() {
            acks++;
          },
        },
      });
      return {
        ...runner,
        async close() {
          await runner.close();
          if (options.closeFailure) throw new Error("Consumer close failed");
        },
      };
    },
  });
  const deliver = (body = wire) =>
    runner.accept({
      body: Buffer.from(JSON.stringify(body)),
      messageId: wire.request,
      headers: {},
      redelivered: false,
      receipt: 1,
    });
  return {
    root,
    worker,
    events,
    writes,
    closes,
    deadLetters,
    entered,
    deliver,
    corrupt() {
      mismatch = true;
    },
    fatal() {
      fatalHook(new Error("Lost broker"));
    },
    stats: () => ({ sourceReads, encodes, acks, decodeCount }),
  };
}

describe("storage-backed media worker", () => {
  it("uploads in order, confirms stable duplicate success without rewriting and validates remote inventory", async () => {
    const f = await fixture();
    try {
      f.deliver();
      await expect.poll(() => f.stats().acks).toBe(1);
      expect(f.writes).toEqual([
        "360/segment00000.ts",
        "720/segment00000.ts",
        "360/index.m3u8",
        "720/index.m3u8",
        "thumbnail.jpg",
        "master.m3u8",
        "_complete.json",
      ]);
      expect(await readdir(f.root)).toEqual([]);
      f.deliver();
      await expect.poll(() => f.stats().acks).toBe(2);
      expect(f.stats()).toEqual({ sourceReads: 1, encodes: 1, acks: 2, decodeCount: 2 });
      expect(f.writes).toHaveLength(7);
      expect(f.events.map((e) => e.id)).toEqual([
        "course-clip:started",
        "course-clip:succeeded",
        "course-clip:succeeded",
      ]);
      expect(f.events[2]?.body.payload).toEqual(f.events[1]?.body.payload);
      f.corrupt();
      f.deliver();
      await expect.poll(() => f.stats().acks).toBe(3);
      expect(f.events.at(-1)?.body.payload).toBe("PROCESSING_FAILED");
      expect(f.writes).toHaveLength(7);
      expect(f.stats().sourceReads).toBe(1);
    } finally {
      await f.worker.close();
      await rm(f.root, { recursive: true });
    }
    expect(f.closes).toEqual(["cancel", "consumer", "publisher", "objects"]);
  });

  it("maps actual byte-hash mismatch to finite failure, cleans temp and invents no malformed identity", async () => {
    const f = await fixture({ badHash: true });
    try {
      f.deliver();
      await expect.poll(() => f.stats().acks).toBe(1);
      expect(f.events.map((e) => e.body.signal)).toEqual(["started", "failed"]);
      expect(f.events.at(-1)?.body.payload).toBe("INVALID_MEDIA");
      expect(f.deadLetters).toEqual(["attachment-jobs.failed"]);
      expect(f.stats().encodes).toBe(0);
      expect(await readdir(f.root)).toEqual([]);
      f.deliver({ ...wire, document: "malformed" });
      await expect.poll(() => f.stats().acks).toBe(2);
      expect(f.events).toHaveLength(2);
      expect(f.writes).toEqual([]);
    } finally {
      await f.worker.close();
      await rm(f.root, { recursive: true });
    }
  });

  it("aborts execution on fatal loss, drains without self-deadlock and contributes only selected storage/queue access", async () => {
    const f = await fixture({ waitEngine: true });
    try {
      f.deliver();
      await f.entered;
      f.fatal();
      expect(await f.worker.closed).toEqual({ fatal: true });
      expect(await readdir(f.root)).toEqual([]);
      expect(f.closes).toContain("objects");
      expect(f.writes).toEqual([]);
    } finally {
      await f.worker.close();
      await rm(f.root, { recursive: true });
    }
    const rejecting = await fixture({ closeFailure: true });
    try {
      await rejecting.worker.close();
      expect(await rejecting.worker.closed).toEqual({ fatal: true });
      expect(rejecting.closes).toEqual(["cancel", "consumer", "publisher", "objects"]);
    } finally {
      await rm(rejecting.root, { recursive: true });
    }
    const generation = generationSelectionsFixture();
    const design = designSchema.parse({
      ...generationSourceFixture(),
      generation: {
        version: 1,
        runtime: generation.runtime,
        selections: generation.selections.filter((s) => s.binding.kind === "video-hls"),
      },
    });
    const bundle = assembleV2({ designJson: JSON.stringify(design) }, loadLocalV2Registry());
    const local = JSON.parse(
      new TextDecoder().decode(bundle.files.find((f) => f.path === "infra/local.json")?.bytes),
    );
    expect(local.storage).toHaveLength(2);
    expect(local.storage.map((s: { read: boolean; write: boolean }) => [s.read, s.write])).toEqual([
      [true, false],
      [true, true],
    ]);
    expect(local.logins).toEqual([]);
    expect(bundle.files.some((f) => f.path.endsWith("media-worker.ts"))).toBe(true);
    expect(bundle.report.applicationComplete).toBe(false);
    for (const f of bundle.files.filter((f) => /media-(?:worker|objects)\.ts$/.test(f.path)))
      expect(new TextDecoder().decode(f.bytes)).not.toMatch(
        /youtube|videoId|from ["'][^"']*(?:postgres|transaction|sql|search|counter)/i,
      );
  });
});

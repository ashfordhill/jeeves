import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { inApplication, serviceContainers } from "./activity.ts";
import type { Application } from "./application.ts";
import { rememberSecrets } from "./evidence.ts";
import { command, hash, poll } from "./process.ts";

export const mediaTemplates = [
  "verified-identity",
  "positive-cache-read",
  "module-stub",
  "module-stub",
  "event-counter",
  "search-query",
  "verified-identity",
  "favorites",
  "verified-identity",
  "owned-multipart",
  "video-hls",
  "asset-lifecycle",
  "search-projection",
];
export const uploads = "/api/upload-api/modules/upload-api-multipart-uploads/uploads";
export const favorites = "/api/account-api/modules/account-api-favorite-videos/items";
export const details = (id: string) => `/api/watch-api/modules/watch-api-video-details-cache/${id}`;
export const counts = (id: string) => `/api/watch-api/modules/watch-api-view-count-reader/${id}`;
export const plays = (id: string) => `/api/watch-api/modules/watch-api-view-publisher/${id}`;
export const search = (app: Application) =>
  app.request("/api/search-api/modules/search-api-video-search?q=saffronfixture");
export function api(app: Application, token: string, path: string, method = "GET", body?: unknown) {
  return app.request(path, {
    method,
    headers: {
      authorization: `Bearer ${token}`,
      ...(body === undefined ? {} : { "content-type": "application/json" }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}
export type Upload = { uploadId: string; assetId: string; partSize: number; partCount: number };
export async function startUpload(app: Application, token: string, bytes: Buffer, name: string) {
  const response = await api(app, token, uploads, "POST", {
    fileName: `${name}.mp4`,
    size: bytes.length,
    contentType: "video/mp4",
    lastModified: 0,
    sha256: hash(bytes),
    title: `saffronfixture ${name}`,
    description: "Deterministic synthetic fixture",
  });
  assert.equal(response.status, 200);
  const upload = response.body as Upload;
  for (const id of [upload.uploadId, upload.assetId]) assert.match(id, /^[a-f0-9-]{36}$/);
  // S3's minimum non-final multipart size, independently specified, not imported from runtime.
  assert.equal(upload.partSize, 5 * 1024 * 1024);
  assert.equal(upload.partCount, Math.ceil(bytes.length / upload.partSize));
  return upload;
}
export async function putPart(
  app: Application,
  token: string,
  upload: Upload,
  bytes: Buffer,
  part: number,
) {
  const signed = await api(app, token, `${uploads}/${upload.uploadId}/parts/${part}`, "POST");
  assert.equal(signed.status, 200);
  const url = (signed.body as { url: string }).url;
  assert.equal(new URL(url).origin, `http://127.0.0.1:${app.stack.ports[2]}`);
  const providerUploadId = new URL(url).searchParams.get("uploadId");
  assert(providerUploadId, "Signed part names its provider multipart upload");
  await rememberSecrets(
    app.directory,
    url,
    providerUploadId,
    ...[...new URL(url).searchParams]
      .filter(([key]) => /^X-Amz-(Signature|Credential|Security-Token)$/i.test(key))
      .map(([, value]) => value),
  );
  const data = bytes.subarray((part - 1) * upload.partSize, part * upload.partSize);
  const response = await fetch(url, {
    method: "PUT",
    body: data,
    signal: AbortSignal.timeout(15_000),
  });
  await response.text();
  const result = {
    partNumber: part,
    size: data.length,
    status: response.status,
    etag: response.headers.get("etag"),
    sha256: hash(data),
  };
  app.record({ multipartTransfer: result });
  assert.equal(result.status, 200);
  assert(result.etag);
  return { ...result, providerUploadId };
}

/** Normal upload credentials independently observe the real provider's abort effect. */
export async function multipartParts(app: Application, upload: Upload, providerUploadId: string) {
  const key = `upload-api-multipart-uploads/${upload.assetId}/${upload.uploadId}/source.mp4`;
  const result = await inApplication<{
    status: number;
    code?: string;
    truncated?: boolean;
    parts?: { partNumber: number; size: number; etag: string }[];
  }>(
    app,
    "app-upload-api",
    `
    import {S3Client,ListPartsCommand} from '@aws-sdk/client-s3';
    import {readFileSync} from 'node:fs';
    const client=new S3Client({endpoint:'http://local-objects:3900',region:'garage',forcePathStyle:true,
      credentials:JSON.parse(readFileSync('/run/secrets/s3-upload-api','utf8')),maxAttempts:1,
      requestHandler:{connectionTimeout:2000,requestTimeout:5000},
      requestChecksumCalculation:'WHEN_REQUIRED',responseChecksumValidation:'WHEN_REQUIRED'});
    try {const value=await client.send(new ListPartsCommand({Bucket:'original-videos',Key:${JSON.stringify(key)},UploadId:${JSON.stringify(providerUploadId)},MaxParts:10}),{abortSignal:AbortSignal.timeout(5000)});
      console.log(JSON.stringify({status:value.$metadata.httpStatusCode,truncated:Boolean(value.IsTruncated),
        parts:value.Parts.map(part=>({partNumber:part.PartNumber,size:part.Size,etag:part.ETag}))}));
    } catch(error) {console.log(JSON.stringify({status:error.$metadata?.httpStatusCode,code:error.name}));}
    finally {client.destroy();}
  `,
  );
  app.record({
    multipartProvider: {
      assetId: upload.assetId,
      providerUploadIdSha256: hash(providerUploadId),
      result,
    },
  });
  return result;
}

/** Real FFmpeg from the fresh export's pinned media image; no downloaded/owner media.
 * `long` is the fault fixture: forty seconds, so an encode lasts long enough to observe and
 * interrupt; it may be a single part. The default is B08's two-part, four-second input. */
export async function syntheticVideo(
  app: Application,
  variant: "multipart" | "long" = "multipart",
) {
  const [container] = await serviceContainers(app, "app-transcoder");
  assert(container);
  const seconds = variant === "long" ? 40 : 4;
  const args = [
    "-hide_banner",
    "-nostdin",
    "-y",
    "-f",
    "lavfi",
    "-i",
    `testsrc2=size=1280x720:rate=30:duration=${seconds}`,
    "-f",
    "lavfi",
    "-i",
    `sine=frequency=440:sample_rate=48000:duration=${seconds}`,
    "-map",
    "0:v:0",
    "-map",
    "1:a:0",
    "-c:v",
    "libx264",
    "-preset",
    "ultrafast",
    ...(variant === "long" ? ["-crf", "30"] : ["-qp", "0"]),
    "-threads",
    "1",
    "-pix_fmt",
    "yuv420p",
    "-c:a",
    "aac",
    "-b:a",
    "128k",
    "-fflags",
    "+bitexact",
    "-flags:v",
    "+bitexact",
    "-flags:a",
    "+bitexact",
    "-map_metadata",
    "-1",
    "-movflags",
    "+faststart",
  ];
  const name = variant === "long" ? "synthetic-long" : "synthetic";
  const source = variant === "long" ? "/tmp/gs-long-source.mp4" : "/tmp/gs-source.mp4";
  const local = join(app.directory, `${name}.mp4`);
  await command("docker", ["exec", container.Id, "ffmpeg", ...args, source], {
    timeoutMs: 60_000,
  });
  await command("docker", ["cp", `${container.Id}:${source}`, local]);
  const bytes = await readFile(local);
  if (variant === "long")
    assert(
      bytes.length > 0 && bytes.length < 30 * 1024 * 1024,
      "Long synthetic video stays within the 30 MiB bound",
    );
  else
    assert(
      bytes.length > 5 * 1024 * 1024 && bytes.length < 30 * 1024 * 1024,
      "Synthetic video exercises multipart within a 30 MiB bound",
    );
  const probe = JSON.parse(
    await command("docker", [
      "exec",
      container.Id,
      "ffprobe",
      "-v",
      "error",
      "-show_streams",
      "-show_format",
      "-of",
      "json",
      source,
    ]),
  );
  const image = JSON.parse(await command("docker", ["inspect", container.Id]))[0];
  await app.save(`${name}-input.json`, {
    args,
    bytes: bytes.length,
    sha256: hash(bytes),
    probe,
    image: { id: image.Image, name: image.Config.Image },
    ffmpeg: await command("docker", ["exec", container.Id, "ffmpeg", "-version"]),
    osLockSha256: hash(await readFile(join(app.directory, "ffmpeg-os.lock"))),
  });
  return bytes;
}

/** Independent provider read using the Transcoder's normal, read-only originals credential. */
export async function originalHash(app: Application, upload: Upload) {
  const key = `upload-api-multipart-uploads/${upload.assetId}/${upload.uploadId}/source.mp4`;
  const result = await inApplication<{ bytes: number; sha256: string }>(
    app,
    "app-transcoder",
    `
    import {S3Client,GetObjectCommand} from '@aws-sdk/client-s3';
    import {readFileSync} from 'node:fs'; import {createHash} from 'node:crypto';
    const client=new S3Client({endpoint:'http://local-objects:3900',region:'garage',forcePathStyle:true,
      credentials:JSON.parse(readFileSync('/run/secrets/s3-transcoder','utf8')),maxAttempts:1,
      requestHandler:{connectionTimeout:2000,requestTimeout:5000},
      requestChecksumCalculation:'WHEN_REQUIRED',responseChecksumValidation:'WHEN_REQUIRED'});
    try { const value=await client.send(new GetObjectCommand({Bucket:'original-videos',Key:${JSON.stringify(key)}}),{abortSignal:AbortSignal.timeout(10000)});
      const bytes=await value.Body.transformToByteArray();
      console.log(JSON.stringify({bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')}));
    } finally {client.destroy();}
  `,
  );
  app.record({ originalReadback: { key, ...result } });
  return result;
}

export type Asset = {
  asset_id: string;
  state: string;
  failure_code: string | null;
  started_at: string | null;
  ready_at: string | null;
  result: unknown;
};
export async function asset(app: Application, id: string) {
  assert.match(id, /^[a-f0-9-]{36}$/);
  const value = await app.sql(
    `SELECT row_to_json(a) FROM (SELECT asset_id,state,failure_code,started_at,ready_at,result FROM upload_api_multipart_uploads.assets WHERE asset_id='${id}') a`,
    "d_metadata",
  );
  return JSON.parse(value) as Asset;
}
export async function assetBecomes(app: Application, id: string, state: string) {
  return poll(
    `${id} lifecycle becomes ${state}`,
    () => asset(app, id),
    (row) => row.state === state,
    120_000,
    (value) => app.record(value),
  );
}
export async function searchDocuments(app: Application) {
  const result = await inApplication<{
    status: number;
    body: {
      hits: {
        total: { value: number };
        hits: { _id: string; _version: number; _source: Record<string, unknown> }[];
      };
    };
  }>(
    app,
    "app-search-indexer",
    `
    const response=await fetch('http://search-videos:9200/videos/_search?version=true&size=100',{signal:AbortSignal.timeout(5000)});
    console.log(JSON.stringify({status:response.status,body:await response.json()}));
  `,
  );
  app.record({ searchProvider: result });
  assert.equal(result.status, 200);
  return result.body.hits;
}
export async function replayPublication(app: Application, id: string) {
  assert.match(id, /^[a-f0-9-]{36}$/);
  const event = JSON.parse(
    await app.sql(
      `SELECT payload FROM upload_api_multipart_uploads.outbox WHERE destination='publication' AND payload->>'videoId'='${id}' AND sent_at IS NOT NULL`,
      "d_metadata",
    ),
  ) as { eventId: string };
  const result = await inApplication(
    app,
    "app-video-lifecycle",
    `
    import amqp from 'amqplib'; import {readFileSync} from 'node:fs';
    const event=${JSON.stringify(event)};
    const connection=await amqp.connect({hostname:'local-broker',username:'runtime',password:readFileSync('/run/secrets/broker-password','utf8').trim(),heartbeat:10});
    const channel=await connection.createConfirmChannel();
    try {channel.publish('publication-events','',Buffer.from(JSON.stringify(event)),{persistent:true,messageId:event.eventId,contentType:'application/json'});
      await channel.waitForConfirms();console.log(JSON.stringify({confirmed:true,eventId:event.eventId}));
    } finally {await channel.close();await connection.close();}
  `,
  );
  app.record({ publicationReplay: { event, result } });
  return result;
}

/** Inspect the real terminal job and acknowledge only after retaining its identity/code. */
export async function failedJob(app: Application) {
  const result = await inApplication<{
    messageId: string;
    body: { videoId: string };
    headers: Record<string, unknown>;
  } | null>(
    app,
    "app-transcoder",
    `
    import amqp from 'amqplib'; import {readFileSync} from 'node:fs';
    const connection=await amqp.connect({hostname:'local-broker',username:'runtime',password:readFileSync('/run/secrets/broker-password','utf8').trim(),heartbeat:10});
    const channel=await connection.createChannel();
    try {const message=await channel.get('upload-jobs.failed',{noAck:false});
      console.log(JSON.stringify(message?{messageId:message.properties.messageId,body:JSON.parse(message.content.toString()),headers:message.properties.headers}:null));
      if(message) channel.ack(message);
    } finally {await channel.close();await connection.close();}
  `,
  );
  app.record({ terminalMediaJob: result });
  return result;
}

/** Public delivery bytes are independently hashed and FFprobed, not generated marker claims. */
export async function delivery(app: Application, manifest: string, thumbnail: string) {
  assert.match(manifest, /^videos\/[a-f0-9-]+\/[a-f0-9-]+\/[a-f0-9-]+\/master\.m3u8$/);
  const get = async (key: string) => {
    const response = await fetch(
      `http://127.0.0.1:${app.stack.ports[0]}/cdn/video-delivery/${key}`,
      { signal: AbortSignal.timeout(10_000) },
    );
    const bytes = Buffer.from(await response.arrayBuffer());
    app.record({
      delivery: {
        key,
        status: response.status,
        bytes: bytes.length,
        sha256: hash(bytes),
        contentType: response.headers.get("content-type"),
      },
    });
    assert.equal(response.status, 200);
    assert(bytes.length > 0);
    return bytes;
  };
  const master = (await get(manifest)).toString();
  assert(master.startsWith("#EXTM3U\n"));
  const playlists = master.split(/\r?\n/).filter((line) => line && !line.startsWith("#"));
  assert.deepEqual(playlists, ["360/index.m3u8", "720/index.m3u8"]);
  const root = manifest.slice(0, -"master.m3u8".length);
  const [worker] = await serviceContainers(app, "app-transcoder");
  assert(worker);
  const probes = [];
  for (const playlist of playlists) {
    const text = (await get(root + playlist)).toString();
    assert(text.includes("#EXT-X-ENDLIST"));
    const segments = text.split(/\r?\n/).filter((line) => line && !line.startsWith("#"));
    assert(segments.length > 0);
    for (const name of segments) assert.match(name, /^segment[0-9]{5}\.ts$/);
    const segment = segments[0];
    assert(segment);
    const bytes = await get(root + playlist.replace("index.m3u8", segment));
    const file = `/tmp/gs-${playlist.startsWith("360") ? "360" : "720"}.ts`;
    // pipe binary directly, without recording/base64-encoding media into reports.
    const local = join(app.directory, file.split("/").at(-1) as string);
    const { writeFile } = await import("node:fs/promises");
    await writeFile(local, bytes);
    await command("docker", ["cp", local, `${worker.Id}:${file}`]);
    const probe = JSON.parse(
      await command("docker", [
        "exec",
        worker.Id,
        "ffprobe",
        "-v",
        "error",
        "-show_streams",
        "-show_format",
        "-of",
        "json",
        file,
      ]),
    );
    assert(
      probe.streams.some(
        (s: { codec_type: string; codec_name: string; height: number }) =>
          s.codec_type === "video" &&
          s.codec_name === "h264" &&
          s.height === (playlist.startsWith("360") ? 360 : 720),
      ),
    );
    assert(
      probe.streams.some(
        (s: { codec_type: string; codec_name: string }) =>
          s.codec_type === "audio" && s.codec_name === "aac",
      ),
    );
    assert(
      Number(probe.format.duration) >= 3.8 && Number(probe.format.duration) <= 4.3,
      "Delivered segment retains the four-second source duration",
    );
    probes.push({ playlist, text, probe });
  }
  const image = await get(thumbnail);
  const local = join(app.directory, "thumbnail.jpg");
  const { writeFile } = await import("node:fs/promises");
  await writeFile(local, image);
  await command("docker", ["cp", local, `${worker.Id}:/tmp/gs-thumbnail.jpg`]);
  const probe = JSON.parse(
    await command("docker", [
      "exec",
      worker.Id,
      "ffprobe",
      "-v",
      "error",
      "-show_streams",
      "-of",
      "json",
      "/tmp/gs-thumbnail.jpg",
    ]),
  );
  assert.equal(probe.streams[0]?.codec_name, "mjpeg");
  assert.equal(probe.streams[0]?.width, 1280);
  assert.equal(probe.streams[0]?.height, 720);
  await app.save("delivery-media.json", {
    master,
    renditions: probes,
    thumbnail: probe,
    humanListeningChecked: false,
  });
}

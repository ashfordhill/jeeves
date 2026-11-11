import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { lstat, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import {
  InvalidMedia,
  localMediaPath,
  probeMedia,
  runMedia,
  validateVideoOriginal,
} from "./media-process.ts";
import {
  bindVideoMarker,
  videoContentType,
  videoHlsJob,
  type VideoCompletionMarker,
  type VideoHlsJob,
} from "./video-result.ts";

const ladder = [
  [360, 640, 1000],
  [720, 1280, 3000],
] as const;
const master =
  "#EXTM3U\n#EXT-X-VERSION:3\n#EXT-X-INDEPENDENT-SEGMENTS\n#EXT-X-STREAM-INF:BANDWIDTH=1250000,RESOLUTION=640x360\n360/index.m3u8\n#EXT-X-STREAM-INF:BANDWIDTH=3500000,RESOLUTION=1280x720\n720/index.m3u8\n";
async function regularFile(file: string, max: number) {
  const stat = await lstat(file);
  if (!stat.isFile() || stat.size < 1 || stat.size > max)
    throw new Error("Invalid local media file");
  return stat;
}
/** Fixed relative references only, finite VOD playlists, no key/map/alternate URI or extra files. */
export function videoPlaylistReferences(playlist: string, names: readonly string[]): string[] {
  const lines = playlist.split(/\r?\n/),
    refs = lines.filter((l) => l && !l.startsWith("#"));
  if (
    !playlist.startsWith("#EXTM3U\n") ||
    !lines.includes("#EXT-X-ENDLIST") ||
    !lines.includes("#EXT-X-PLAYLIST-TYPE:VOD") ||
    refs.length < 1 ||
    refs.length > 160 ||
    new Set(refs).size !== refs.length ||
    refs.some((r) => !/^segment[0-9]{5}\.ts$/.test(r)) ||
    lines.some((l) => l.startsWith("#") && l.includes("URI=")) ||
    names.length !== refs.length + 1 ||
    !names.includes("index.m3u8") ||
    refs.some((r) => !names.includes(r))
  )
    throw new Error("Unsafe or incomplete HLS inventory");
  return refs;
}
/** Verify local package files and hash their actual bytes. Marker is returned, never published;
 * immutable object checks/reuse and marker-last upload are the runner's responsibility. */
export async function packageVideoHls(
  output: string,
  input: VideoHlsJob,
  duration: number,
  signal: AbortSignal,
): Promise<VideoCompletionMarker> {
  const job = videoHlsJob.parse(input);
  localMediaPath(output);
  signal.throwIfAborted();
  const root = await readdir(output, { withFileTypes: true });
  if (
    root.length !== 3 ||
    !["360", "720"].every((name) => root.some((r) => r.name === name && r.isDirectory())) ||
    !root.some((r) => r.name === "thumbnail.jpg" && r.isFile())
  )
    throw new Error("Unexpected video package files");
  const files: string[] = [];
  for (const [height] of ladder) {
    const dir = join(output, String(height)),
      names = await readdir(dir);
    await regularFile(join(dir, "index.m3u8"), 65536);
    const refs = videoPlaylistReferences(await readFile(join(dir, "index.m3u8"), "utf8"), names);
    files.push(...refs.map((r) => `${height}/${r}`), `${height}/index.m3u8`);
  }
  await writeFile(join(output, "master.m3u8"), master, { flag: "wx" });
  files.push("thumbnail.jpg", "master.m3u8");
  const inventory: VideoCompletionMarker["inventory"] = [];
  for (const path of files) {
    signal.throwIfAborted();
    const file = join(output, path),
      stat = await regularFile(file, 268435456);
    const hash = createHash("sha256");
    let size = 0;
    for await (const chunk of createReadStream(file, { signal })) {
      size += chunk.length;
      if (size > stat.size) throw new Error("Local video file changed");
      hash.update(chunk);
    }
    if (size !== stat.size) throw new Error("Local video file changed");
    inventory.push({ path, size, sha256: hash.digest("hex"), contentType: videoContentType(path) });
  }
  return bindVideoMarker(
    {
      schemaVersion: 1,
      assetId: job.assetId,
      jobId: job.jobId,
      attemptId: job.attemptId,
      source: job.source,
      result: {
        prefix: job.resultPrefix,
        manifest: job.resultPrefix + "master.m3u8",
        thumbnail: job.resultPrefix + "thumbnail.jpg",
        marker: job.resultPrefix + "_complete.json",
        durationSeconds: duration,
        renditions: ladder.map(([height, width]) => ({
          height,
          width,
          playlist: job.resultPrefix + `${height}/index.m3u8`,
          videoCodec: "h264",
          audioCodec: "aac",
        })),
      },
      inventory,
    },
    job,
  );
}
export interface VideoHlsInput {
  /** Already downloaded/hash-verified by the caller. Engine checks regular-file byte size. */
  input: string;
  /** Fresh absolute directory: created exclusively here; existing directories are refused. */
  output: string;
  job: VideoHlsJob;
  signal: AbortSignal;
}
/** Fixed MP4/H.264/AAC landscape preset. A single 20-minute execution signal bounds all work.
 * Failure removes only our newly created output after subprocess close. Caller must finally
 * remove its execution workspace (input and successful output) after consuming the package. */
export async function encodeVideoHls(input: VideoHlsInput): Promise<VideoCompletionMarker> {
  const job = videoHlsJob.parse(input.job),
    sourceFile = resolve(localMediaPath(input.input)),
    output = resolve(localMediaPath(input.output)),
    signal = AbortSignal.any([input.signal, AbortSignal.timeout(1200000)]);
  signal.throwIfAborted();
  if (sourceFile === output) throw new Error("Input and output paths must differ");
  const stat = await regularFile(sourceFile, 268435456);
  if (stat.size !== job.source.size) throw new InvalidMedia();
  await mkdir(output); // No recursive mkdir or overwrite of caller-owned data.
  try {
    let source;
    try {
      source = validateVideoOriginal(await probeMedia(sourceFile, signal));
    } catch (error) {
      if (signal.aborted) throw error;
      throw new InvalidMedia();
    }
    for (const [height, width, rate] of ladder) {
      signal.throwIfAborted();
      const dir = join(output, String(height));
      await mkdir(dir);
      await runMedia(
        "ffmpeg",
        [
          "-hide_banner",
          "-nostdin",
          "-y",
          "-protocol_whitelist",
          "file,crypto,data",
          "-i",
          sourceFile,
          "-map",
          "0:v:0",
          "-map",
          "0:a:0",
          "-vf",
          `scale=${width}:${height}:force_original_aspect_ratio=decrease,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2,setsar=1`,
          "-c:v",
          "libx264",
          "-preset",
          "veryfast",
          "-threads",
          "2",
          "-pix_fmt",
          "yuv420p",
          "-b:v",
          `${rate}k`,
          "-maxrate",
          `${rate}k`,
          "-bufsize",
          `${rate * 2}k`,
          "-force_key_frames",
          "expr:gte(t,n_forced*4)",
          "-sc_threshold",
          "0",
          "-flags",
          "+cgop",
          "-c:a",
          "aac",
          "-b:a",
          "128k",
          "-ac",
          "2",
          "-ar",
          "48000",
          "-f",
          "hls",
          "-hls_time",
          "4",
          "-hls_playlist_type",
          "vod",
          "-hls_flags",
          "independent_segments",
          "-hls_segment_filename",
          join(dir, "segment%05d.ts"),
          join(dir, "index.m3u8"),
        ],
        signal,
      );
      const p = await probeMedia(join(dir, "index.m3u8"), signal),
        videos = p.streams.filter((s) => s.codec_type === "video"),
        audios = p.streams.filter((s) => s.codec_type === "audio"),
        v = videos[0],
        duration = Number(p.format.duration);
      if (
        videos.length !== 1 ||
        audios.length !== 1 ||
        v?.codec_name !== "h264" ||
        v.width !== width ||
        v.height !== height ||
        audios[0]?.codec_name !== "aac" ||
        !Number.isFinite(duration) ||
        Math.abs(duration - source.duration) > 1
      )
        throw new Error("Encoded rendition verification failed");
    }
    const thumbnail = join(output, "thumbnail.jpg");
    await runMedia(
      "ffmpeg",
      [
        "-hide_banner",
        "-nostdin",
        "-y",
        "-ss",
        "0.5",
        "-protocol_whitelist",
        "file,crypto,data",
        "-i",
        sourceFile,
        "-map",
        "0:v:0",
        "-frames:v",
        "1",
        "-update",
        "1",
        "-threads",
        "1",
        "-q:v",
        "2",
        thumbnail,
      ],
      signal,
    );
    const image = await probeMedia(thumbnail, signal),
      v = image.streams[0];
    if (
      image.streams.length !== 1 ||
      v?.codec_name !== "mjpeg" ||
      v.width !== source.width ||
      v.height !== source.height
    )
      throw new Error("Thumbnail verification failed");
    const marker = await packageVideoHls(output, job, source.duration, signal);
    signal.throwIfAborted();
    return marker;
  } catch (error) {
    await rm(output, { recursive: true, force: true });
    throw error;
  }
}

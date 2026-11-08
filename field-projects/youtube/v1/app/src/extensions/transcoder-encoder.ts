import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { probe, run, validateOriginal } from "../lib/media.ts";
export async function handle(input: string, output: string, signal: AbortSignal) {
  let source;
  try {
    source = validateOriginal(await probe(input, signal));
  } catch (e) {
    if (signal.aborted) throw e;
    throw new (await import("../lib/amqp.ts")).NonRetryable("INVALID_MEDIA");
  }
  for (const [height, width, rate] of [
    [360, 640, 1000],
    [720, 1280, 3000],
  ] as const) {
    const dir = join(output, String(height));
    await mkdir(dir);
    await run(
      "ffmpeg",
      [
        "-hide_banner",
        "-nostdin",
        "-y",
        "-i",
        input,
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
    const p = await probe(join(dir, "index.m3u8"), signal),
      v = p.streams.find((s) => s.codec_type === "video");
    if (
      v?.codec_name !== "h264" ||
      v.width !== width ||
      v.height !== height ||
      !p.streams.some((s) => s.codec_name === "aac") ||
      Math.abs(Number(p.format.duration) - source.duration) > 1
    )
      throw new Error("Encoded rendition verification failed");
    console.log(JSON.stringify({ rendition: height, probe: p }));
  }
  return source;
}

import { join } from "node:path";
import { probe, run } from "../lib/media.ts";
export async function handle(
  input: string,
  output: string,
  dimensions: { width: number; height: number },
  signal: AbortSignal,
) {
  const file = join(output, "thumbnail.jpg");
  await run(
    "ffmpeg",
    [
      "-hide_banner",
      "-nostdin",
      "-y",
      "-ss",
      "0.5",
      "-i",
      input,
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
      file,
    ],
    signal,
  );
  const p = await probe(file, signal),
    v = p.streams[0];
  if (v?.codec_name !== "mjpeg" || v.width !== dimensions.width || v.height !== dimensions.height)
    throw new Error("Thumbnail verification failed");
}

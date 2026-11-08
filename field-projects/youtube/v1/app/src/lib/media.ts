import { spawn } from "node:child_process";
import { NonRetryable } from "./amqp.ts";
export const invalidMedia = () => new NonRetryable("INVALID_MEDIA");
// Safe argv only. One execution's AbortSignal also bounds downloads and all subprocesses.
export function run(binary: string, args: string[], signal: AbortSignal, timeout = 1200000) {
  console.log(JSON.stringify({ binary, args }));
  return new Promise<string>((resolve, reject) => {
    signal.throwIfAborted();
    const child = spawn(binary, args, { stdio: ["ignore", "pipe", "pipe"] });
    let spawnError: Error | undefined, killing: ReturnType<typeof setTimeout> | undefined;
    const cancel = () => {
      child.kill("SIGTERM");
      killing ??= setTimeout(() => child.kill("SIGKILL"), 1000);
    };
    signal.addEventListener("abort", cancel, { once: true });
    let output = "",
      error = "",
      overflow = false;
    child.stdout.on("data", (b: Buffer) => {
      output += b.toString();
      if (output.length > 1024 * 1024) {
        overflow = true;
        child.kill("SIGKILL");
      }
    });
    child.stderr.on("data", (b: Buffer) => {
      const text = b.toString();
      process.stderr.write(text);
      error = (error + text).slice(-4096);
    });
    const timer = setTimeout(() => child.kill("SIGKILL"), timeout);
    child.once("error", (e) => {
      spawnError = e;
    });
    child.once("close", (code) => {
      clearTimeout(timer);
      clearTimeout(killing);
      signal.removeEventListener("abort", cancel);
      if (spawnError) {
        reject(spawnError);
        return;
      }
      if (signal.aborted) {
        reject(signal.reason);
        return;
      }
      if (code === 0 && !overflow) resolve(output);
      else reject(new Error(`Media subprocess failed (${binary}, ${code}): ${error.slice(-200)}`));
    });
  });
}
export interface Probe {
  streams: {
    codec_type?: string;
    codec_name?: string;
    width?: number;
    height?: number;
    side_data_list?: { rotation?: number }[];
    tags?: { rotate?: string };
  }[];
  format: { format_name?: string; duration?: string };
}
export async function probe(file: string, signal: AbortSignal): Promise<Probe> {
  return JSON.parse(
    await run(
      "ffprobe",
      ["-v", "error", "-show_streams", "-show_format", "-of", "json", file],
      signal,
      30000,
    ),
  );
}
export function validateOriginal(p: Probe) {
  const video = p.streams.filter((s) => s.codec_type === "video"),
    audio = p.streams.filter((s) => s.codec_type === "audio");
  const v = video[0],
    duration = Number(p.format.duration);
  if (
    !p.format.format_name?.split(",").includes("mp4") ||
    video.length !== 1 ||
    audio.length !== 1 ||
    v?.codec_name !== "h264" ||
    audio[0]?.codec_name !== "aac" ||
    !v.width ||
    !v.height ||
    v.height < 720 ||
    v.height > 1080 ||
    v.width < v.height ||
    v.width > 1920 ||
    v.width % 2 ||
    v.height % 2 ||
    !Number.isFinite(duration) ||
    duration < 1 ||
    duration > 600 ||
    (v.side_data_list ?? []).some((s) => s.rotation && s.rotation % 360 !== 0) ||
    Number(v.tags?.rotate ?? 0) % 360 !== 0
  )
    throw invalidMedia();
  return { width: v.width, height: v.height, duration };
}

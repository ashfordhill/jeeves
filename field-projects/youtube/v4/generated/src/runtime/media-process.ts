import { spawn } from "node:child_process";
import { isAbsolute } from "node:path";

export class InvalidMedia extends Error {
  readonly code = "INVALID_MEDIA";
  constructor() {
    super("INVALID_MEDIA");
  }
}
/** No shell, stdin, remote input or caller-selected encoder options in the engine. Output is
 * bounded, abort/timeout always rejects, and close is awaited after TERM/KILL before cleanup. */
export function runMedia(
  binary: "ffmpeg" | "ffprobe",
  args: readonly string[],
  signal: AbortSignal,
) {
  signal.throwIfAborted();
  return new Promise<string>((resolve, reject) => {
    const child = spawn(binary, [...args], { shell: false, stdio: ["ignore", "pipe", "pipe"] });
    let spawnError: Error | undefined, killing: ReturnType<typeof setTimeout> | undefined;
    let output = "",
      error = "",
      size = 0,
      overflow = false,
      timedOut = false;
    const cancel = () => {
      child.kill("SIGTERM");
      killing ??= setTimeout(() => child.kill("SIGKILL"), 1000);
    };
    signal.addEventListener("abort", cancel, { once: true });
    if (signal.aborted) cancel();
    child.stdout.on("data", (b: Buffer) => {
      size += b.length;
      if (size > 1024 * 1024) {
        overflow = true;
        child.kill("SIGKILL");
      } else output += b.toString();
    });
    child.stderr.on("data", (b: Buffer) => {
      error = (error + b.toString()).slice(-4096);
    });
    const timer = setTimeout(
      () => {
        timedOut = true;
        child.kill("SIGKILL");
      },
      binary === "ffprobe" ? 30000 : 1200000,
    );
    child.once("error", (e) => {
      spawnError = e;
    });
    child.once("close", (code) => {
      clearTimeout(timer);
      clearTimeout(killing);
      signal.removeEventListener("abort", cancel);
      if (signal.aborted) reject(signal.reason);
      else if (spawnError) reject(spawnError);
      else if (code === 0 && !overflow && !timedOut) resolve(output);
      else reject(new Error(`Media subprocess failed (${binary}, ${code}): ${error.slice(-200)}`));
    });
  });
}
export interface MediaProbe {
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
export function localMediaPath(file: string): string {
  if (typeof file !== "string" || !isAbsolute(file) || file.includes("\0"))
    throw new Error("Media path must be absolute and local");
  return file;
}
export async function probeMedia(file: string, signal: AbortSignal): Promise<MediaProbe> {
  const raw = JSON.parse(
    await runMedia(
      "ffprobe",
      [
        "-v",
        "error",
        "-protocol_whitelist",
        "file,crypto,data",
        "-show_streams",
        "-show_format",
        "-of",
        "json",
        localMediaPath(file),
      ],
      signal,
    ),
  );
  if (!raw || !Array.isArray(raw.streams) || !raw.format || typeof raw.format !== "object")
    throw new InvalidMedia();
  return raw;
}
export function validateVideoOriginal(p: MediaProbe) {
  const video = p.streams.filter((s) => s.codec_type === "video"),
    audio = p.streams.filter((s) => s.codec_type === "audio"),
    v = video[0],
    duration = Number(p.format.duration);
  if (
    !p.format.format_name?.split(",").includes("mp4") ||
    video.length !== 1 ||
    audio.length !== 1 ||
    v?.codec_name !== "h264" ||
    audio[0]?.codec_name !== "aac" ||
    !Number.isInteger(v.width) ||
    !Number.isInteger(v.height) ||
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
    (v.side_data_list ?? []).some(
      (s) => s.rotation !== undefined && (!Number.isFinite(s.rotation) || s.rotation % 360 !== 0),
    ) ||
    !Number.isFinite(Number(v.tags?.rotate ?? 0)) ||
    Number(v.tags?.rotate ?? 0) % 360 !== 0
  )
    throw new InvalidMedia();
  return { width: v.width, height: v.height, duration };
}

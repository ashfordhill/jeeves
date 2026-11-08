import { createClient } from "redis";
import { connect as metadata } from "../clients/watch-details.ts";
import { connect as counts } from "../clients/watch-counts.ts";
import { uuid } from "../contracts/v1.ts";
import { secret } from "../lib/env.ts";
import { createHttpService, HttpError } from "../lib/http.ts";
import { readyReader } from "../state/watch.ts";
const details = metadata(),
  totals = counts();
for (const p of [details, totals]) p.on("error", () => console.error("Watch database unavailable"));
const cache = createClient({
  url: "redis://cache:6379",
  password: secret("cache_password"),
  disableOfflineQueue: true,
  commandsQueueMaxLength: 32,
  socket: { connectTimeout: 500, reconnectStrategy: false },
});
cache.on("error", () => console.error("Ready cache connection unavailable"));
let usable = false;
async function bounded<T>(f: () => Promise<T>): Promise<T> {
  if (!usable) throw new Error("Cache unavailable");
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      f(),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          usable = false;
          if (cache.isOpen) cache.destroy();
          reject(new Error("Cache deadline"));
        }, 150);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}
const read = readyReader(details, {
  get: (key) => bounded(() => cache.get(key)),
  set: (key, value, options) => bounded(() => cache.set(key, value, options)),
});
const service = await createHttpService(
  "watch",
  { concurrencyLimit: 2000, requestTimeoutMs: 1000 },
  (app) => {
    app.get("/videos/:videoId", async (req) => {
      const id = uuid.safeParse((req.params as { videoId: string }).videoId);
      if (!id.success) throw new HttpError(400, "VIDEO_ID", "Invalid video identity.");
      const video = await read(id.data);
      if (!video)
        throw new HttpError(404, "VIDEO_NOT_READY", "This video is not publicly available.");
      const result = await totals.query(
        "SELECT views FROM count_public.video_totals WHERE video_id=$1",
        [id.data],
      );
      return {
        ...video,
        manifestUrl: `/media/${video.manifest}`,
        thumbnailUrl: `/media/${video.thumbnail}`,
        views: result.rows[0]?.views ?? "0",
      };
    });
    app.post("/videos/:videoId/views", async () => {
      throw new HttpError(503, "COUNTS_UNAVAILABLE", "Playback counting is not available yet.");
    });
  },
  async () => {
    await details.query("SELECT video_id FROM video_public.ready_videos LIMIT 0");
    await totals.query("SELECT video_id FROM count_public.video_totals LIMIT 0");
    try {
      await cache.connect();
      usable = true;
    } catch {
      console.error("Ready cache unavailable; primary fallback enabled");
    }
  },
);
let shutdown: Promise<void> | undefined;
function close() {
  return (shutdown ??= (async () => {
    await service.close();
    usable = false;
    if (cache.isOpen) cache.destroy();
    await details.end();
    await totals.end();
  })());
}
try {
  await service.start();
  let stop!: () => void;
  const requested = new Promise<void>((resolve) => {
    stop = resolve;
  });
  for (const signal of ["SIGINT", "SIGTERM"] as const) process.once(signal, stop);
  await requested;
  for (const signal of ["SIGINT", "SIGTERM"] as const) process.removeListener(signal, stop);
  await close();
} catch {
  console.error("Watch startup failed; inspect public views/provider readiness.");
  process.exitCode = 1;
  await close();
}

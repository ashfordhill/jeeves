interface PublicVideo {
  videoId: string;
  title: string;
  description: string;
  channel: string;
  durationSeconds: number;
  manifestUrl: string;
  thumbnailUrl: string;
  views: string;
  publishedAt: string;
}
interface HlsPlayer {
  loadSource(url: string): void;
  attachMedia(video: HTMLVideoElement): void;
  destroy(): void;
  on(
    event: string,
    callback: (event: string, data: { fatal?: boolean; type?: string }) => void,
  ): void;
}
declare global {
  interface Window {
    Hls?: { new (config?: unknown): HlsPlayer; isSupported(): boolean; Events: { ERROR: string } };
  }
}
const el = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
let player: HlsPlayer | undefined, request: AbortController | undefined;
const video = el<HTMLVideoElement>("player"),
  status = el("watch-status");
function clear() {
  player?.destroy();
  player = undefined;
  video.pause();
  video.removeAttribute("src");
  video.removeAttribute("poster");
  video.load();
  el("watch-details").hidden = true;
}
export async function openWatch(id: string) {
  request?.abort();
  request = new AbortController();
  clear();
  status.textContent = "Loading public video…";
  if (!/^[a-f0-9-]{36}$/.test(id)) {
    status.textContent = "Enter a valid video ID.";
    return;
  }
  const own = request;
  try {
    const r = await fetch(`/api/watch/videos/${id}`, {
      signal: AbortSignal.any([own.signal, AbortSignal.timeout(5000)]),
    });
    const data = await r
      .json()
      .catch(() => ({ message: "Video service unavailable. Try again shortly." }));
    if (!r.ok) throw new Error(data.message ?? "Video unavailable. Try again shortly.");
    if (own !== request) return;
    const d = data as PublicVideo;
    el("watch-title").textContent = d.title;
    el("watch-description").textContent = d.description;
    el("watch-byline").textContent =
      `${d.channel} · ${d.views} views · ${Math.round(d.durationSeconds)} seconds`;
    video.poster = d.thumbnailUrl;
    el<HTMLImageElement>("thumbnail").src = d.thumbnailUrl;
    if (video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = d.manifestUrl;
    } else if (window.Hls?.isSupported()) {
      player = new window.Hls({ maxBufferLength: 30 });
      player.on(window.Hls.Events.ERROR, (_event, data) => {
        if (data.fatal) {
          status.textContent = "Playback failed. Open the video again to retry.";
          video.pause();
        }
      });
      player.loadSource(d.manifestUrl);
      player.attachMedia(video);
    } else throw new Error("This browser cannot play HLS. Try a browser with H.264/AAC support.");
    el("watch-details").hidden = false;
    status.textContent = "Public video ready. Click Play. Playback counting is not available yet.";
    const url = new URL(location.href);
    url.searchParams.set("watch", id);
    history.replaceState(null, "", url);
    el<HTMLInputElement>("watch-id").value = id;
    el("watch").scrollIntoView({ behavior: "smooth", block: "start" });
  } catch (e) {
    if (own !== request || own.signal.aborted) return;
    clear();
    status.textContent = e instanceof Error ? e.message : "Video unavailable.";
  }
}
el<HTMLFormElement>("watch-form").onsubmit = (e) => {
  e.preventDefault();
  void openWatch(el<HTMLInputElement>("watch-id").value.trim());
};
video.addEventListener("error", () => {
  status.textContent = "Playback failed. Open the video again to retry.";
});
window.addEventListener("pagehide", () => {
  request?.abort();
  clear();
});
const id = new URL(location.href).searchParams.get("watch");
if (id) void openWatch(id);

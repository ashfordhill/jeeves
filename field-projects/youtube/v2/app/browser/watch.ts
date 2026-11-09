import { PlaybackPolicy } from "./playback-policy.ts";
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
interface WatchSession {
  id: string;
  eventId: string;
  policy: PlaybackPolicy;
  signal: AbortSignal;
  accepted: boolean;
  sending: boolean;
  waiting: boolean;
  tick: ReturnType<typeof setInterval>;
  poll: ReturnType<typeof setInterval>;
}
let session: WatchSession | undefined;
const viewStatus = el("view-status"),
  retryView = el<HTMLButtonElement>("retry-view");
function clear() {
  if (session) {
    clearInterval(session.tick);
    clearInterval(session.poll);
    session = undefined;
  }
  retryView.hidden = true;
  viewStatus.textContent = "";
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
    el("watch-byline").textContent = `${d.channel} · ${Math.round(d.durationSeconds)} seconds`;
    el("watch-views").textContent = `${d.views} views`;
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
    status.textContent = "Public video ready. Click Play.";
    startSession(id, own.signal);
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

async function refreshCount(own: WatchSession) {
  try {
    const r = await fetch(`/api/watch/videos/${own.id}`, {
      signal: AbortSignal.any([own.signal, AbortSignal.timeout(5000)]),
    });
    if (!r.ok) throw new Error("Count refresh unavailable.");
    const d = (await r.json()) as PublicVideo;
    if (own === session) {
      el("watch-views").textContent = `${d.views} views`;
      if (own.accepted) viewStatus.textContent = "Playback accepted. Counts update shortly.";
    }
  } catch {
    if (own === session && own.accepted)
      viewStatus.textContent = "Playback accepted. Count refresh unavailable; retrying shortly.";
  }
}
async function sendView(own: WatchSession) {
  if (own !== session || own.accepted || own.sending) return;
  own.sending = true;
  retryView.hidden = true;
  for (let attempt = 0; attempt < 3 && own === session && !own.signal.aborted; attempt++) {
    try {
      viewStatus.textContent = "Confirming playback…";
      const r = await fetch(`/api/watch/videos/${own.id}/views`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventId: own.eventId }),
        signal: AbortSignal.any([own.signal, AbortSignal.timeout(5000)]),
      });
      const d = await r.json().catch(() => ({}));
      if (r.status !== 202 || d.accepted !== true || d.eventId !== own.eventId) {
        if (r.status >= 400 && r.status < 500) break;
        throw new Error("Playback confirmation unavailable.");
      }
      own.accepted = true;
      if (own === session) {
        viewStatus.textContent = "Playback accepted. Counts update shortly.";
        await refreshCount(own);
      }
      break;
    } catch {
      /* An uncertain response retries the same event identity. */
    }
    if (attempt < 2) await new Promise((resolve) => setTimeout(resolve, (attempt + 1) * 1000));
  }
  own.sending = false;
  if (own === session && !own.accepted) {
    viewStatus.textContent = "Could not confirm playback. Retry to send this same playback event.";
    retryView.hidden = false;
  }
}
function startSession(id: string, signal: AbortSignal) {
  const own: WatchSession = {
    id,
    eventId: crypto.randomUUID(),
    policy: new PlaybackPolicy(),
    signal,
    accepted: false,
    sending: false,
    waiting: false,
    tick: setInterval(() => {
      const active =
        !video.paused &&
        !video.ended &&
        !video.seeking &&
        !own.waiting &&
        video.readyState >= 3 &&
        video.playbackRate === 1 &&
        document.visibilityState === "visible";
      if (own === session && own.policy.sample(video.currentTime, performance.now(), active))
        void sendView(own);
    }, 250),
    poll: setInterval(() => {
      if (own === session) void refreshCount(own);
    }, 2000),
  };
  session = own;
  viewStatus.textContent =
    "A view counts after 2 cumulative seconds of normal playback on this page.";
}
retryView.onclick = () => {
  if (session?.policy.triggered) void sendView(session);
};
for (const event of [
  "pause",
  "seeking",
  "seeked",
  "ratechange",
  "ended",
  "waiting",
  "stalled",
  "playing",
])
  video.addEventListener(event, () => {
    session?.policy.reset();
    if (session && (event === "waiting" || event === "stalled")) session.waiting = true;
    if (session && event === "playing") session.waiting = false;
  });
document.addEventListener("visibilitychange", () => session?.policy.reset());

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

// v2's watch page, moved to v3's Watch API routes. Watch's sign-in is Optional: the token is sent
// when signed in and nothing when signed out; a refused one asks to sign in again. A play counts
// once two cumulative seconds have played (v1's policy): one event ID per video per page load,
// sent once and retried with the same ID. The count is read from its own route, fresh.
import { optionalAuthorization, SignInAgain, signInAgain } from "./auth.ts";
import { PlaybackPolicy } from "./playback-policy.ts";
const WATCH = "/api/watch-api/modules";
const details = (id: string) => `${WATCH}/watch-api-video-details-cache/${id}`;
const count = (id: string) => `${WATCH}/watch-api-view-count-reader/${id}`;
const play = (id: string) => `${WATCH}/watch-api-view-publisher/${id}`;
interface WatchedVideo {
  videoId: string;
  title: string;
  description: string;
  channel: string;
  durationSeconds: number;
  manifestUrl: string;
  thumbnailUrl: string;
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
/** A Watch API request: the token when signed in; 401 forgets it and asks to sign in again. */
async function watchFetch(url: string, signal: AbortSignal, init: RequestInit = {}) {
  const r = await fetch(url, {
    ...init,
    headers: { ...optionalAuthorization(), ...(init.headers as Record<string, string>) },
    signal: AbortSignal.any([signal, AbortSignal.timeout(5000)]),
  });
  if (r.status === 401) throw signInAgain();
  return r;
}
const el = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
let player: HlsPlayer | undefined, request: AbortController | undefined;
const video = el<HTMLVideoElement>("player"),
  status = el("watch-status");
/** This page load's play of each video: its one event ID, its played seconds and whether it was accepted. */
interface Play {
  eventId: string;
  policy: PlaybackPolicy;
  accepted: boolean;
}
const plays = new Map<string, Play>();
interface WatchSession {
  id: string;
  play: Play;
  signal: AbortSignal;
  sending: boolean;
  waiting: boolean;
  tick: ReturnType<typeof setInterval>;
  poll: ReturnType<typeof setInterval>;
}
let session: WatchSession | undefined;
const viewStatus = el("view-status"),
  retryView = el<HTMLButtonElement>("retry-view");
const opened = new Set<(video: WatchedVideo | undefined) => void>();
/** Called with each video opened (and undefined when none is), for the favorite toggle. */
export function onWatchOpened(listener: (video: WatchedVideo | undefined) => void) {
  opened.add(listener);
}
export function watchedVideoId() {
  return session?.id;
}
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
  for (const listener of opened) listener(undefined);
}
export async function openWatch(id: string) {
  request?.abort();
  request = new AbortController();
  clear();
  status.textContent = "Loading public video…";
  if (!/^[a-f0-9-]{36}$/i.test(id)) {
    status.textContent = "Enter a valid video ID.";
    return;
  }
  const own = request;
  try {
    const r = await watchFetch(details(id), own.signal);
    const data = await r
      .json()
      .catch(() => ({ message: "Video service unavailable. Try again shortly." }));
    if (r.status === 404) throw new Error("This video is not publicly available.");
    if (!r.ok) throw new Error(data.message ?? "Video unavailable. Try again shortly.");
    if (own !== request) return;
    const d = data as WatchedVideo;
    el("watch-title").textContent = d.title;
    el("watch-description").textContent = d.description;
    el("watch-byline").textContent = `${d.channel} · ${Math.round(d.durationSeconds)} seconds`;
    el("watch-views").textContent = "";
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
    startSession(d.videoId, own.signal);
    for (const listener of opened) listener(d);
    const url = new URL(location.href);
    url.searchParams.set("watch", d.videoId);
    history.replaceState(null, "", url);
    el<HTMLInputElement>("watch-id").value = d.videoId;
    el("watch").scrollIntoView({ behavior: "smooth", block: "start" });
  } catch (e) {
    if (own !== request || own.signal.aborted) return;
    clear();
    status.textContent = e instanceof Error ? e.message : "Video unavailable.";
  }
}

async function refreshCount(own: WatchSession) {
  try {
    const r = await watchFetch(count(own.id), own.signal);
    if (!r.ok) throw new Error("Count refresh unavailable.");
    const d = (await r.json()) as { views: string };
    if (own === session) {
      el("watch-views").textContent = `${d.views} views`;
      if (own.play.accepted) viewStatus.textContent = "Playback accepted. Counts update shortly.";
    }
  } catch (e) {
    if (e instanceof SignInAgain) return;
    if (own === session && own.play.accepted)
      viewStatus.textContent = "Playback accepted. Count refresh unavailable; retrying shortly.";
  }
}
async function sendView(own: WatchSession) {
  if (own !== session || own.play.accepted || own.sending) return;
  own.sending = true;
  retryView.hidden = true;
  for (let attempt = 0; attempt < 3 && own === session && !own.signal.aborted; attempt++) {
    try {
      viewStatus.textContent = "Confirming playback…";
      const r = await watchFetch(play(own.id), own.signal, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventId: own.play.eventId }),
      });
      const d = await r.json().catch(() => ({}));
      if (r.status !== 202 || d.accepted !== true || d.eventId !== own.play.eventId) {
        if (r.status >= 400 && r.status < 500) break;
        throw new Error("Playback confirmation unavailable.");
      }
      own.play.accepted = true;
      if (own === session) {
        viewStatus.textContent = "Playback accepted. Counts update shortly.";
        await refreshCount(own);
      }
      break;
    } catch (e) {
      if (e instanceof SignInAgain) break;
      /* An uncertain response retries the same event identity. */
    }
    if (attempt < 2) await new Promise((resolve) => setTimeout(resolve, (attempt + 1) * 1000));
  }
  own.sending = false;
  if (own === session && !own.play.accepted) {
    viewStatus.textContent = "Could not confirm playback. Retry to send this same playback event.";
    retryView.hidden = false;
  }
}
function startSession(id: string, signal: AbortSignal) {
  let play = plays.get(id);
  if (!play) {
    play = { eventId: crypto.randomUUID(), policy: new PlaybackPolicy(), accepted: false };
    plays.set(id, play);
  }
  play.policy.reset();
  const own: WatchSession = {
    id,
    play,
    signal,
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
      if (own === session && own.play.policy.sample(video.currentTime, performance.now(), active))
        void sendView(own);
    }, 250),
    poll: setInterval(() => {
      if (own === session) void refreshCount(own);
    }, 2000),
  };
  session = own;
  viewStatus.textContent = play.accepted
    ? "Playback accepted. Counts update shortly."
    : "A view counts after 2 cumulative seconds of normal playback on this page.";
  void refreshCount(own);
}
retryView.onclick = () => {
  if (session?.play.policy.triggered) void sendView(session);
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
    session?.play.policy.reset();
    if (session && (event === "waiting" || event === "stalled")) session.waiting = true;
    if (session && event === "playing") session.waiting = false;
  });
document.addEventListener("visibilitychange", () => session?.play.policy.reset());

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
/** Opens the video in the page's address (`?watch=<id>`), once the sign-in is settled. */
export function startWatch() {
  const id = new URL(location.href).searchParams.get("watch");
  if (id) void openWatch(id);
}

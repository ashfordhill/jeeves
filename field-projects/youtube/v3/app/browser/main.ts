// v2's creator page, moved to v3's routes: one sign-in (the header) for creators and watchers.
// A creator uploads in resumable parts and sees each upload's status; any signed-in account keeps
// favorites; anyone watches and searches. The upload's status is the upload's own (multipart's
// answers can't carry the video's state, template gap 1): a completed upload's video is ready
// once Watch's details answer it.
import "./search.ts";
import { showFavorites } from "./favorites.ts";
import { openWatch, startWatch } from "./watch.ts";
import {
  finishLogin,
  login,
  logout,
  onSignInAgain,
  optionalAuthorization,
  requiredAuthorization,
  session,
  SignInAgain,
  signInAgain,
} from "./auth.ts";
const UPLOADS = "/api/upload-api/modules/upload-api-multipart-uploads/uploads";
const ME = "/api/watch-api/modules/watch-api-viewer-check/me";
const DETAILS = "/api/watch-api/modules/watch-api-video-details-cache";
interface Fingerprint {
  fileName: string;
  size: number;
  contentType: string;
  lastModified: number;
  sha256: string;
}
interface Part {
  partNumber: number;
  size: number;
  etag: string;
}
interface Metadata {
  title: string;
  description: string;
  channel: string;
}
interface Upload {
  uploadId: string;
  assetId: string;
  metadata: Metadata;
  state: string;
  phase: string;
  file: Fingerprint;
  partSize: number;
  partCount: number;
  parts: Part[];
  failureCode: string | null;
}
interface Recent {
  uploadId: string;
  assetId: string;
  metadata: Metadata;
  state: string;
  failureCode: string | null;
}
/** The signed-in account isn't a creator: uploads answer 403 CREATOR_REQUIRED. */
class NotCreator extends Error {
  constructor() {
    super("This account isn't a creator account. Watching, search and favorites work; uploading needs a creator.");
  }
}
const element = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const fileInput = element<HTMLInputElement>("file"),
  title = element<HTMLInputElement>("title"),
  description = element<HTMLTextAreaElement>("description");
const controls = element<HTMLFieldSetElement>("creator-controls"),
  signIn = element<HTMLButtonElement>("login"),
  signOut = element<HTMLButtonElement>("logout"),
  refresh = element<HTMLButtonElement>("refresh"),
  resume = element<HTMLButtonElement>("resume"),
  pause = element<HTMLButtonElement>("pause"),
  start = element<HTMLButtonElement>("start");
let signedIn = false,
  creator = false,
  running = false,
  paused = false,
  selected: Upload | null = null,
  xhr: XMLHttpRequest | undefined;
let poll: ReturnType<typeof setTimeout> | undefined;
/** Videos Watch has answered: ready stays ready. */
const ready = new Set<string>();
function message(text: string, error = false) {
  const p = element("message");
  p.textContent = text;
  p.classList.toggle("error", error);
}
function buttons() {
  controls.disabled = !creator;
  refresh.disabled = !creator || running;
  signIn.hidden = signedIn;
  signOut.hidden = !signedIn;
  if (!signedIn) element("identity").textContent = "Signed out";
  start.disabled = running;
  resume.disabled = running;
  resume.hidden = !selected || selected.state !== "uploading";
  pause.hidden = !running;
}
function report(e: unknown) {
  message(e instanceof Error ? e.message : "The operation failed. Try again.", true);
  buttons();
}
function action(f: () => Promise<unknown>) {
  return () => {
    void f().catch(report);
  };
}
onSignInAgain((text) => {
  signedIn = false;
  creator = false;
  showFavorites(false);
  element("uploads").textContent = "Sign in with a creator account to see your uploads.";
  message(text, true);
  buttons();
});
async function api<T>(path: string, method = "GET", body?: unknown): Promise<T> {
  const r = await fetch(`${UPLOADS}${path}`, {
    method,
    headers: {
      ...requiredAuthorization(),
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    signal: AbortSignal.timeout(10000),
  });
  const data = await r
    .json()
    .catch(() => ({ message: "The service is unavailable. Try again shortly." }));
  if (!r.ok) {
    if (r.status === 401) throw signInAgain();
    if (r.status === 403 && data.error === "CREATOR_REQUIRED") {
      creator = false;
      buttons();
      throw new NotCreator();
    }
    // Multipart's own refusals carry one message; their code says which (template gap 1).
    throw new Error(
      data.message === "Upload operation refused." && data.error
        ? `Upload refused: ${data.error}. Check its status before retrying.`
        : (data.message ?? "The request failed. Check status before retrying."),
    );
  }
  return data as T;
}
/** Whether a completed upload's video is ready: Watch's details answer it (else 404). */
async function isReady(videoId: string) {
  if (ready.has(videoId)) return true;
  const r = await fetch(`${DETAILS}/${videoId}`, {
    headers: optionalAuthorization(),
    signal: AbortSignal.timeout(5000),
  });
  if (r.status === 401) throw signInAgain();
  if (r.ok) ready.add(videoId);
  return r.ok;
}
const label = (state: string, videoId: string, failure: string | null) =>
  state === "completed"
    ? ready.has(videoId)
      ? "ready"
      : "uploaded · not ready yet"
    : state === "failed" && failure
      ? `failed · ${failure}`
      : state;
function remember(u: Upload) {
  localStorage.setItem("upload-selection", JSON.stringify({ uploadId: u.uploadId, file: u.file }));
}
async function show(u: Upload) {
  selected = u;
  remember(u);
  if (u.state === "completed") await isReady(u.assetId);
  const state = label(u.state, u.assetId, u.failureCode);
  element("current").textContent = `${u.metadata.title} · ${state} · Video ${u.assetId}`;
  if (u.state === "completed") {
    progress(u.file.size, u.file.size, `Upload complete · ${state}`);
  } else if (u.state === "uploading") {
    progress(
      u.parts.reduce((n, p) => n + p.size, 0),
      u.file.size,
      `${u.parts.length} of ${u.partCount} parts acknowledged · ${u.state}`,
    );
  } else {
    progress(0, u.file.size, `Upload ${state}`);
  }
  buttons();
}
function progress(bytes: number, total: number, text: string) {
  element<HTMLProgressElement>("progress").value = Math.min(100, (bytes / total) * 100);
  element("progress-text").textContent = text;
}
async function select(id: string) {
  if (running) throw new Error("Pause the current upload first.");
  const u = await api<Upload>(`/${id}`);
  await show(u);
  title.value = u.metadata.title;
  description.value = u.metadata.description;
  fileInput.value = "";
  if (u.state === "uploading")
    message(`Selected “${u.metadata.title}”. Reselect the same file and click Resume.`);
  else message(`“${u.metadata.title}” is ${label(u.state, u.assetId, u.failureCode)}.`);
}
async function recent() {
  const data = await api<{ uploads: Recent[] }>("");
  creator = true;
  const container = element("uploads");
  const rows: HTMLElement[] = [];
  for (const r of data.uploads) {
    if (r.state === "completed") await isReady(r.assetId);
    const row = document.createElement("div");
    row.className = "upload";
    const p = document.createElement("p"),
      strong = document.createElement("strong"),
      badge = document.createElement("span");
    strong.textContent = r.metadata.title;
    badge.textContent = label(r.state, r.assetId, r.failureCode);
    badge.className = "badge";
    p.append(strong, " ", badge);
    row.append(p);
    const view = document.createElement("button");
    view.textContent = r.state === "uploading" ? "Select to resume" : "View status";
    view.disabled = running;
    view.onclick = action(() => select(r.uploadId));
    row.append(view);
    if (r.state === "uploading") {
      const abort = document.createElement("button");
      abort.textContent = "Abort upload";
      abort.disabled = running;
      abort.onclick = action(async () => {
        await api(`/${r.uploadId}/abort`, "POST");
        if (selected?.uploadId === r.uploadId) await show(await api<Upload>(`/${r.uploadId}`));
        message(`“${r.metadata.title}” was aborted.`);
        await recent();
      });
      row.append(abort);
    }
    if (r.state === "completed" && ready.has(r.assetId)) {
      const watch = document.createElement("button");
      watch.textContent = "Watch video";
      watch.onclick = () => {
        void openWatch(r.assetId);
      };
      row.append(watch);
    }
    rows.push(row);
  }
  if (rows.length) container.replaceChildren(...rows);
  else container.textContent = "No uploads yet.";
}
async function fingerprint(file: File): Promise<Fingerprint> {
  if (file.size < 1 || file.size > 256 * 1024 * 1024)
    throw new Error("Choose a file between 1 byte and 256 MiB.");
  if (!/\.mp4$/i.test(file.name) || file.type !== "video/mp4")
    throw new Error("Choose an MP4 video (H.264/AAC, landscape 720p–1080p, 1–600 seconds).");
  message("Checking the selected file…");
  const hash = Array.from(
    new Uint8Array(await crypto.subtle.digest("SHA-256", await file.arrayBuffer())),
  )
    .map((n) => n.toString(16).padStart(2, "0"))
    .join("");
  return {
    fileName: file.name,
    size: file.size,
    contentType: file.type,
    lastModified: file.lastModified,
    sha256: hash,
  };
}
function put(url: string, blob: Blob, onProgress: (bytes: number) => void) {
  return new Promise<string>((resolve, reject) => {
    const request = new XMLHttpRequest();
    xhr = request;
    request.open("PUT", url);
    request.timeout = 60000;
    request.setRequestHeader("Content-Type", "application/octet-stream");
    request.upload.onprogress = (e) => onProgress(e.loaded);
    request.onload = () => {
      const etag = request.getResponseHeader("ETag");
      if (request.status >= 200 && request.status < 300 && etag) resolve(etag);
      else
        reject(
          new Error(
            request.status === 403
              ? "Part permission expired. Click Resume to renew it."
              : "A part could not be acknowledged. Click Resume to retry.",
          ),
        );
    };
    request.onerror = request.ontimeout = () =>
      reject(new Error("Upload connection interrupted. Reselect the same file and click Resume."));
    request.onabort = () =>
      reject(new Error("Upload paused. Reselect the same file and click Resume."));
    request.send(blob);
  }).finally(() => {
    xhr = undefined;
  });
}
async function transfer(u: Upload, file: File) {
  paused = false;
  running = true;
  buttons();
  try {
    await recent();
    let acknowledged = 0;
    for (let number = 1; number <= u.partCount; number++) {
      const offset = (number - 1) * u.partSize,
        size = Math.min(u.partSize, file.size - offset);
      const saved = u.parts.find((p) => p.partNumber === number && p.size === size && p.etag);
      if (saved) {
        acknowledged += size;
        continue;
      }
      if (paused) throw new Error("Upload paused. Reselect the same file and click Resume.");
      const signed = await api<{ url: string; expiresAt: string }>(
        `/${u.uploadId}/parts/${number}`,
        "POST",
      );
      if (paused) throw new Error("Upload paused. Reselect the same file and click Resume.");
      message(`Uploading part ${number} of ${u.partCount}…`);
      await put(signed.url, file.slice(offset, offset + size), (sent) =>
        progress(acknowledged + sent, file.size, `Sending part ${number} of ${u.partCount}`),
      );
      acknowledged += size;
      progress(acknowledged, file.size, `${number} of ${u.partCount} parts acknowledged`);
    }
    if (paused) throw new Error("Upload paused. Click Resume to finish.");
    await api(`/${u.uploadId}/complete`, "POST");
    await show(await api<Upload>(`/${u.uploadId}`));
    message("Upload received. Its status below changes to ready once the video is published.");
  } finally {
    running = false;
    buttons();
    await recent().catch(() => {});
  }
}
element<HTMLFormElement>("upload-form").onsubmit = (e) => {
  e.preventDefault();
  void (async () => {
    const file = fileInput.files?.[0];
    if (!file) throw new Error("Choose a video file.");
    if (!title.value.trim()) throw new Error("Enter a title.");
    running = true;
    buttons();
    try {
      const f = await fingerprint(file);
      const created = await api<{ uploadId: string }>("", "POST", {
        ...f,
        title: title.value,
        description: description.value,
      });
      await show(await api<Upload>(`/${created.uploadId}`));
    } finally {
      running = false;
      buttons();
    }
    await transfer(selected!, file);
  })().catch(report);
};
resume.onclick = action(async () => {
  const file = fileInput.files?.[0];
  if (!file || !selected) throw new Error("Reselect the original file first.");
  running = true;
  buttons();
  let u: Upload;
  try {
    const f = await fingerprint(file);
    u = await api<Upload>(`/${selected.uploadId}`);
    await show(u);
    if (
      f.sha256 !== u.file.sha256 ||
      f.size !== u.file.size ||
      f.fileName !== u.file.fileName ||
      f.contentType !== u.file.contentType ||
      f.lastModified !== u.file.lastModified
    )
      throw new Error("This file differs from the original upload. Reselect the same file.");
  } finally {
    running = false;
    buttons();
  }
  await transfer(u!, file);
});
pause.onclick = () => {
  paused = true;
  xhr?.abort();
  message("Pausing upload…");
};
signIn.onclick = action(login);
signOut.onclick = logout;
refresh.onclick = action(async () => {
  await recent();
  if (selected) await show(await api<Upload>(`/${selected.uploadId}`));
  message("Upload status refreshed.");
});
async function tick() {
  try {
    if (creator && !running) {
      await recent();
      if (selected) await show(await api<Upload>(`/${selected.uploadId}`));
    }
  } catch (e) {
    if (!(e instanceof SignInAgain)) report(e);
  }
  poll = setTimeout(() => {
    void tick();
  }, 5000);
}
window.addEventListener("pagehide", () => {
  clearTimeout(poll);
  xhr?.abort();
});
/** Who is signed in, from Watch's Optional check: any account, or nobody. */
async function identify() {
  if (!session()) {
    optionalAuthorization(); // an expired kept sign-in asks to sign in again
    return;
  }
  const r = await fetch(ME, { headers: optionalAuthorization(), signal: AbortSignal.timeout(5000) });
  if (r.status === 401) throw signInAgain();
  if (!r.ok) throw new Error("Sign-in check unavailable. Try again shortly.");
  const me = (await r.json()) as { signedIn: boolean; username: string | null };
  if (!me.signedIn) return;
  signedIn = true;
  element("identity").textContent = `Signed in as ${me.username ?? "your account"}`;
}
async function creatorPanel() {
  try {
    await recent();
  } catch (e) {
    if (e instanceof SignInAgain) return;
    if (e instanceof NotCreator) {
      element("uploads").textContent = "Uploads need a creator account.";
      message("Signed in. Watch, search and keep favorites; uploading needs a creator account.");
      return;
    }
    throw e;
  }
  message("Choose a video or resume a recent upload.");
  buttons();
  const stored = localStorage.getItem("upload-selection");
  if (stored) {
    try {
      const saved = JSON.parse(stored);
      if (typeof saved.uploadId === "string") await select(saved.uploadId);
    } catch {
      localStorage.removeItem("upload-selection");
    }
  }
}
async function initialize() {
  try {
    await finishLogin();
  } catch (e) {
    report(e);
  }
  try {
    await identify();
  } catch (e) {
    if (!(e instanceof SignInAgain)) report(e);
  }
  buttons();
  startWatch();
  showFavorites(signedIn);
  if (!signedIn) return;
  await creatorPanel();
  void tick();
}
void initialize().catch(report);

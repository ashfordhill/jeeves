import "./search.ts";
import { openWatch } from "./watch.ts";
import { clearAuth, finishLogin, login, logout, session } from "./auth.ts";
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
interface Upload {
  uploadId: string;
  videoId: string;
  title: string;
  description: string;
  state: string;
  phase: string;
  file: Fingerprint;
  partSize: number;
  partCount: number;
  parts: Part[];
  jobId: string | null;
  attemptId: string | null;
  failure: { code: string; message: string } | null;
}
interface Recent {
  uploadId: string;
  videoId: string;
  title: string;
  state: string;
  failure: { message: string } | null;
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
let trusted = false,
  running = false,
  paused = false,
  selected: Upload | null = null,
  xhr: XMLHttpRequest | undefined;
let poll: ReturnType<typeof setTimeout> | undefined;
function message(text: string, error = false) {
  const p = element("message");
  p.textContent = text;
  p.classList.toggle("error", error);
}
function buttons() {
  controls.disabled = !trusted;
  refresh.disabled = !trusted || running;
  signIn.hidden = trusted;
  signOut.hidden = !trusted;
  if (!trusted) element("identity").textContent = "Signed out";
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
async function api<T>(path: string, method = "GET", body?: unknown): Promise<T> {
  const s = session();
  if (!s) {
    trusted = false;
    clearAuth();
    buttons();
    throw new Error("Your sign-in expired. Sign in again to continue this upload.");
  }
  const r = await fetch(`/api/upload${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${s.access}`,
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    signal: AbortSignal.timeout(10000),
  });
  const data = await r
    .json()
    .catch(() => ({ message: "The service is unavailable. Try again shortly." }));
  if (!r.ok) {
    if (r.status === 401 || r.status === 403) {
      trusted = false;
      clearAuth();
      buttons();
    }
    throw new Error(data.message ?? "The request failed. Check status before retrying.");
  }
  return data as T;
}
function remember(u: Upload) {
  localStorage.setItem("upload-selection", JSON.stringify({ uploadId: u.uploadId, file: u.file }));
}
function show(u: Upload) {
  selected = u;
  remember(u);
  element("current").textContent =
    `${u.title} · ${u.state} · Video ${u.videoId}${u.failure ? ` · ${u.failure.message}` : ""}`;
  if (["pending", "processing", "ready"].includes(u.state) || (u.state === "failed" && u.jobId)) {
    progress(
      u.file.size,
      u.file.size,
      `Upload complete · ${u.state === "pending" ? "Pending processing" : u.state}`,
    );
  } else if (u.state === "uploading") {
    progress(
      u.parts.reduce((n, p) => n + p.size, 0),
      u.file.size,
      `${u.parts.length} of ${u.partCount} parts acknowledged · ${u.state}`,
    );
  } else {
    progress(0, u.file.size, `Upload ${u.state}${u.failure ? ` · ${u.failure.message}` : ""}`);
  }
  buttons();
}
function progress(bytes: number, total: number, text: string) {
  element<HTMLProgressElement>("progress").value = Math.min(100, (bytes / total) * 100);
  element("progress-text").textContent = text;
}
async function select(id: string) {
  if (running) throw new Error("Pause the current upload first.");
  const u = await api<Upload>(`/uploads/${id}`);
  show(u);
  title.value = u.title;
  description.value = u.description;
  fileInput.value = "";
  if (u.state === "uploading")
    message(`Selected “${u.title}”. Reselect the same file and click Resume.`);
  else message(u.failure?.message ?? `“${u.title}” is ${u.state}.`);
}
async function recent() {
  const data = await api<{ uploads: Recent[] }>("/uploads");
  const container = element("uploads");
  container.replaceChildren();
  if (!data.uploads.length) {
    container.textContent = "No uploads yet.";
    return;
  }
  for (const r of data.uploads) {
    const row = document.createElement("div");
    row.className = "upload";
    const p = document.createElement("p"),
      strong = document.createElement("strong"),
      badge = document.createElement("span");
    strong.textContent = r.title;
    badge.textContent = r.state;
    badge.className = "badge";
    p.append(strong, " ", badge);
    row.append(p);
    if (r.failure) {
      const error = document.createElement("p");
      error.textContent = r.failure.message;
      row.append(error);
    }
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
        await api(`/uploads/${r.uploadId}/abort`, "POST");
        if (selected?.uploadId === r.uploadId) show(await api<Upload>(`/uploads/${r.uploadId}`));
        message(`“${r.title}” was aborted.`);
        await recent();
      });
      row.append(abort);
    }
    if (r.state === "ready") {
      const watch = document.createElement("button");
      watch.textContent = "Watch video";
      watch.onclick = () => {
        void openWatch(r.videoId);
      };
      row.append(watch);
    }
    container.append(row);
  }
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
        `/uploads/${u.uploadId}/parts/${number}`,
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
    await api(`/uploads/${u.uploadId}/complete`, "POST");
    show(await api<Upload>(`/uploads/${u.uploadId}`));
    message("Upload received. Processing status will update below.");
  } finally {
    running = false;
    buttons();
    await recent();
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
      const created = await api<{ uploadId: string }>("/uploads", "POST", {
        ...f,
        title: title.value,
        description: description.value,
      });
      show(await api<Upload>(`/uploads/${created.uploadId}`));
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
    u = await api<Upload>(`/uploads/${selected.uploadId}`);
    show(u);
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
  if (selected) show(await api<Upload>(`/uploads/${selected.uploadId}`));
  message("Upload status refreshed.");
});
async function tick() {
  try {
    if (trusted && !running) {
      await recent();
      if (selected) show(await api<Upload>(`/uploads/${selected.uploadId}`));
    }
  } catch (e) {
    report(e);
  }
  poll = setTimeout(() => {
    void tick();
  }, 5000);
}
window.addEventListener("pagehide", () => {
  clearTimeout(poll);
  xhr?.abort();
});
async function initialize() {
  await finishLogin();
  if (!session()) {
    buttons();
    return;
  }
  const me = await api<{ sub: string; channel: string }>("/me");
  trusted = true;
  element("identity").textContent = `Signed in as ${me.channel}`;
  message("Choose a video or resume a recent upload.");
  buttons();
  await recent();
  const stored = localStorage.getItem("upload-selection");
  if (stored) {
    try {
      const saved = JSON.parse(stored);
      if (typeof saved.uploadId === "string") await select(saved.uploadId);
    } catch {
      localStorage.removeItem("upload-selection");
    }
  }
  void tick();
}
void initialize().catch(report);

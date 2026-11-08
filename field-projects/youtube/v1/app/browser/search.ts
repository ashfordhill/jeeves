import { openWatch } from "./watch.ts";
const el = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const query = el<HTMLInputElement>("search-query"),
  status = el("search-status"),
  results = el("search-results"),
  previous = el<HTMLButtonElement>("search-previous"),
  next = el<HTMLButtonElement>("search-next");
let request: AbortController | undefined,
  currentQuery = "",
  page = 1;
interface Hit {
  videoId: string;
  title: string;
  description: string;
  channel: string;
  thumbnailUrl: string;
}
async function search(q: string, target: number) {
  request?.abort();
  const own = new AbortController();
  request = own;
  previous.hidden = true;
  next.hidden = true;
  status.textContent = "Searching…";
  results.replaceChildren();
  try {
    const r = await fetch(
      `/api/search/videos?${new URLSearchParams({ q, page: String(target) })}`,
      {
        signal: AbortSignal.any([own.signal, AbortSignal.timeout(5000)]),
      },
    );
    const d = await r.json().catch(() => ({ message: "Search unavailable. Try again shortly." }));
    if (!r.ok) throw new Error(d.message ?? "Search unavailable. Try again shortly.");
    if (request !== own) return;
    currentQuery = q;
    page = target;
    status.textContent = `${d.total} results · Page ${page}`;
    for (const hit of d.hits as Hit[]) {
      const row = document.createElement("article"),
        title = document.createElement("h3"),
        byline = document.createElement("p"),
        description = document.createElement("p"),
        button = document.createElement("button");
      title.textContent = hit.title;
      byline.textContent = hit.channel;
      description.textContent = hit.description;
      button.textContent = "Watch video";
      button.onclick = () => {
        void openWatch(hit.videoId);
      };
      row.append(title, byline, description, button);
      results.append(row);
    }
    previous.hidden = page <= 1;
    next.hidden = page >= 100 || page * 20 >= d.total;
  } catch (e) {
    if (request === own && !own.signal.aborted)
      status.textContent = e instanceof Error ? e.message : "Search unavailable.";
  }
}
el<HTMLFormElement>("search-form").onsubmit = (e) => {
  e.preventDefault();
  void search(query.value.trim(), 1);
};
previous.onclick = () => {
  void search(currentQuery, page - 1);
};
next.onclick = () => {
  void search(currentQuery, page + 1);
};
window.addEventListener("pagehide", () => request?.abort());

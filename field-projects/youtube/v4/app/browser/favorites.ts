// Favorites for signed-in watchers (D4), on v3's Account API (Required sign-in): the ☆/★ toggle on
// the open video and the "My favorites" list. Signed out, neither is shown. An item is the video's
// lower-case ID, as Watch's details give it.
import { requiredAuthorization, session, SignInAgain, signInAgain } from "./auth.ts";
import { onWatchOpened, openWatch, watchedVideoId } from "./watch.ts";
const ITEMS = "/api/account-api/modules/account-api-favorite-videos/items";
const DETAILS = "/api/watch-api/modules/watch-api-video-details-cache";
const el = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const toggle = el<HTMLButtonElement>("favorite"),
  section = el("favorites"),
  list = el("favorites-list"),
  status = el("favorites-status"),
  more = el<HTMLButtonElement>("favorites-more");
interface Favorite {
  itemId: string;
  addedAt: string;
}
let favorite = false,
  next: string | null = null;

async function account(path: string, method = "GET") {
  const r = await fetch(`${ITEMS}${path}`, {
    method,
    headers: requiredAuthorization(),
    signal: AbortSignal.timeout(5000),
  });
  if (r.status === 401) throw signInAgain();
  return r;
}
function report(e: unknown) {
  if (e instanceof SignInAgain) return;
  status.textContent = e instanceof Error ? e.message : "Favorites are unavailable. Try again.";
}
function showToggle() {
  toggle.textContent = favorite ? "★ In favorites" : "☆ Add to favorites";
  toggle.setAttribute("aria-pressed", String(favorite));
}

/** The toggle for the open video: shown only when signed in. */
async function check(videoId: string | undefined) {
  toggle.hidden = true;
  if (!videoId || !session()) return;
  const r = await account(`/${videoId}`);
  if (r.status !== 200 && r.status !== 404) throw new Error("Favorites are unavailable. Try again.");
  if (watchedVideoId() !== videoId) return;
  favorite = r.status === 200;
  showToggle();
  toggle.hidden = false;
}
onWatchOpened((video) => {
  void check(video?.videoId).catch(report);
});
toggle.onclick = () => {
  const videoId = watchedVideoId();
  if (!videoId) return;
  toggle.disabled = true;
  void (async () => {
    const r = await account(`/${videoId}`, favorite ? "DELETE" : "PUT");
    const data = await r.json().catch(() => ({}));
    if (favorite ? r.status !== 204 : r.status !== 200)
      throw new Error(data.message ?? "Favorites are unavailable. Try again.");
    favorite = !favorite;
    showToggle();
    await refresh();
  })()
    .catch(report)
    .finally(() => {
      toggle.disabled = false;
    });
};

/** One row of the list: the video's title from Watch's details, or that it is no longer public. */
async function row(item: Favorite) {
  const container = document.createElement("div"),
    title = document.createElement("p"),
    strong = document.createElement("strong"),
    watch = document.createElement("button"),
    remove = document.createElement("button");
  container.className = "upload";
  strong.textContent = `Video ${item.itemId}`;
  title.append(strong);
  try {
    const r = await fetch(`${DETAILS}/${item.itemId}`, {
      headers: requiredAuthorization(),
      signal: AbortSignal.timeout(5000),
    });
    if (r.status === 401) throw signInAgain();
    if (r.ok) strong.textContent = ((await r.json()) as { title: string }).title;
    else if (r.status === 404) title.append(" · no longer available");
  } catch (e) {
    if (e instanceof SignInAgain) throw e;
  }
  watch.textContent = "Watch video";
  watch.onclick = () => {
    void openWatch(item.itemId);
  };
  remove.textContent = "Remove";
  remove.onclick = () => {
    remove.disabled = true;
    void (async () => {
      const r = await account(`/${item.itemId}`, "DELETE");
      if (r.status !== 204) throw new Error("Favorites are unavailable. Try again.");
      if (watchedVideoId() === item.itemId) {
        favorite = false;
        showToggle();
      }
      await refresh();
    })().catch(report);
  };
  container.append(title, watch, remove);
  return container;
}
async function page(after?: string) {
  const r = await account(after ? `?${new URLSearchParams({ after })}` : "");
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data.message ?? "Favorites are unavailable. Try again.");
  const items = data.items as Favorite[];
  for (const item of items) list.append(await row(item));
  next = data.next;
  more.hidden = !next;
  status.textContent = list.childElementCount
    ? `${list.childElementCount} favorite${list.childElementCount === 1 ? "" : "s"}, newest first.`
    : "No favorites yet. Open a video and click ☆ to add it.";
}
/** Reloads the list from the first page; shown only when signed in. */
async function refresh() {
  list.replaceChildren();
  more.hidden = true;
  await page();
}
more.onclick = () => {
  if (next) void page(next).catch(report);
};
/** Shows the toggle and the list for a signed-in account; hides both when signed out. */
export function showFavorites(signedIn: boolean) {
  section.hidden = !signedIn;
  if (!signedIn) {
    toggle.hidden = true;
    list.replaceChildren();
    return;
  }
  void refresh().catch(report);
  void check(watchedVideoId()).catch(report);
}

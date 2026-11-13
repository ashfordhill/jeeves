// PF12/PF13 steps by API through the edge, on V3-17's lib.mjs. Tokens stay in memory.
// node pf.mjs <step> <label> [args]. Writes ./runs/<label>.json.
import { randomUUID } from "node:crypto";
import { writeFileSync } from "node:fs";
import { api, log, token } from "./lib.mjs";

const W = "/api/watch-api/modules";
const details = (id) => `${W}/watch-api-video-details-cache/${id}`;
const count = (id) => `${W}/watch-api-view-count-reader/${id}`;
const play = (id) => `${W}/watch-api-view-publisher/${id}`;
const search = (q) => `/api/search-api/modules/search-api-video-search?q=${encodeURIComponent(q)}`;
const FAV = "/api/account-api/modules/account-api-favorite-videos/items";
const ME = [
  `${W}/watch-api-viewer-check/me`,
  "/api/upload-api/modules/upload-api-creator-check/me",
  "/api/account-api/modules/account-api-account-check/me",
];
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
/** Reads every `every` ms until `done` holds or `ms` pass; keeps only the last read in the log. */
async function poll(read, done, ms, every = 250) {
  const started = Date.now();
  for (;;) {
    const entry = await read();
    if (done(entry) || Date.now() - started >= ms) return { entry, afterMs: Date.now() - started };
    log.pop();
    await sleep(every);
  }
}
const [step, label, ...args] = process.argv.slice(2);
if (!label) throw new Error("Usage: node pf.mjs <step> <label> [args]");
const out = { step, label, args };
switch (step) {
  case "signin": {
    const creator = { who: "creator", bearer: await token("creator") };
    const viewer = { who: "viewer", bearer: await token("viewer") };
    for (const path of ME) {
      await api("GET", path);
      await api("GET", path, creator);
      await api("GET", path, viewer);
    }
    break;
  }
  case "ready": {
    const [id, seconds = "120"] = args;
    const seen = await poll(
      () => api("GET", details(id)),
      (e) => e.status === 200,
      Number(seconds) * 1000,
      2000,
    );
    out.ready = { status: seen.entry.status, afterMs: seen.afterMs };
    break;
  }
  case "details": {
    const [id, times = "1"] = args;
    for (let i = 0; i < Number(times); i++) await api("GET", details(id));
    out.statuses = log.map((e) => e.status);
    break;
  }
  case "plays": {
    const [id, n = "1"] = args;
    const before = BigInt((await api("GET", count(id))).body.views);
    const ids = Array.from({ length: Number(n) }, () => randomUUID());
    for (const eventId of ids) await api("POST", play(id), { body: { eventId } });
    const expected = before + BigInt(ids.length);
    const seen = await poll(
      () => api("GET", count(id)),
      (e) => e.status === 200 && BigInt(e.body.views) >= expected,
      10000,
    );
    for (const eventId of ids) await api("POST", play(id), { body: { eventId } });
    await sleep(5000);
    const settled = await api("GET", count(id));
    out.counts = {
      before: String(before),
      expected: String(expected),
      after: seen.entry.body?.views,
      visibleAfterMs: seen.afterMs,
      settled: settled.body?.views,
    };
    out.playStatuses = [...new Set(log.filter((e) => e.method === "POST").map((e) => e.status))];
    break;
  }
  case "search": {
    const [word, id] = args;
    const hits = (e) => (e.body?.hits ?? []).filter((hit) => hit.videoId === id).length;
    const seen = await poll(
      () => api("GET", search(word)),
      (e) => hits(e) > 0,
      10000,
    );
    out.search = { status: seen.entry.status, found: hits(seen.entry), afterMs: seen.afterMs };
    break;
  }
  case "favorites": {
    const [id] = args;
    const viewer = { who: "viewer", bearer: await token("viewer") };
    await api("PUT", `${FAV}/${id}`, viewer);
    await api("GET", `${FAV}/${id}`, viewer);
    const listed = await api("GET", FAV, viewer);
    out.listed = (listed.body?.items ?? []).some((item) => item.itemId === id);
    await api("DELETE", `${FAV}/${id}`, viewer);
    await api("PUT", `${FAV}/${id}`);
    break;
  }
  default:
    throw new Error("Steps: signin, ready, details, plays, search, favorites");
}
out.log = log;
writeFileSync(new URL(`./runs/${label}.json`, import.meta.url), JSON.stringify(out, null, 2));
for (const e of log) console.log(`${e.method} ${e.path} [${e.who}] → ${e.status}`);
console.log(JSON.stringify({ ...out, log: undefined }));

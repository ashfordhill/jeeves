// Actual exported pinned pg driver, unconnected Client, deterministic private timer observation.
// No Postgres/network, native matrix, substitute declaration or production clock override.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

const app = (await readFile("/tmp/jeeves-rg20-compile-path", "utf8")).trim();
const { default: pg } = await import(pathToFileURL(`${app}/node_modules/pg/lib/index.js`));
const client = new pg.Client({ query_timeout: 2500 });
const timers = [],
  originalSet = globalThis.setTimeout,
  originalClear = globalThis.clearTimeout;
globalThis.setTimeout = (callback, milliseconds) => {
  const handle = { callback, milliseconds };
  timers.push(handle);
  return handle;
};
globalThis.clearTimeout = (handle) => {
  if (!timers.includes(handle)) originalClear(handle);
};
try {
  const actual = client.query({ text: "SELECT 1", query_timeout: 5500 });
  const observed = assert.rejects(actual, /Query read timeout/);
  assert.equal(timers.length, 1);
  assert.equal(timers[0].milliseconds, 5500);
  timers[0].callback();
  await observed;
  assert.equal(client.queryQueue.length, 0);
  timers.length = 0;
  const ordinary = client.query("SELECT 1");
  const defaultObserved = assert.rejects(ordinary, /Query read timeout/);
  assert.equal(timers.length, 1);
  assert.equal(timers[0].milliseconds, 2500);
  timers[0].callback();
  await defaultObserved;
  assert.equal(client.connectionParameters.query_timeout, 2500);
  console.log(
    "Actual pg per-query query_timeout5500 overrides pooled2500 default; timeout rejects the actual driver promise without a database connection",
  );
  console.log(
    "Ordinary subsequent query retains2500ms default; pinned driver",
    JSON.parse(await readFile(`${app}/node_modules/pg/package.json`, "utf8")).version,
  );
} finally {
  globalThis.setTimeout = originalSet;
  globalThis.clearTimeout = originalClear;
}

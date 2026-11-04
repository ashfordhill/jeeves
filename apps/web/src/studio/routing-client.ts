import type { RouteBox, StudioGeometry, StudioPath } from "./routing.ts";

export interface StudioRoutingInput {
  scope: string;
  sizingVersion: 1;
  paths: StudioPath[];
  nodes: Record<string, RouteBox>;
  widths: Record<string, number>;
  fixed?: StudioGeometry;
  /** Child → frame node IDs (SG05), so paths may enter their own frame. */
  parents?: Record<string, string>;
}
const cache = new Map<string, StudioGeometry>();
type Job = { promise: Promise<StudioGeometry>; cancel: () => void; users: number };
const running = new Map<string, Job>();

/** Exact scope/topology/sizing/position keys coalesce work; zoom and selection never enter here. */
export async function routeStudio(input: StudioRoutingInput, signal: AbortSignal) {
  signal.throwIfAborted();
  const key = JSON.stringify(input);
  const cached = cache.get(key);
  if (cached) {
    cache.delete(key);
    cache.set(key, cached);
    return Promise.resolve(cached);
  }
  let job = running.get(key);
  if (!job) {
    const worker = new Worker(new URL("./routing.worker.ts", import.meta.url), { type: "module" });
    let cancel = () => {};
    const promise = new Promise<StudioGeometry>((resolve, reject) => {
      const fail = (message: string) => reject(new Error(message));
      cancel = () => reject(new DOMException("Studio routing superseded.", "AbortError"));
      worker.addEventListener("error", () => fail("Diagram routing could not run."));
      worker.addEventListener("messageerror", () =>
        fail("Diagram routing returned unreadable data."),
      );
      worker.addEventListener(
        "message",
        ({ data }: MessageEvent<{ geometry?: StudioGeometry; error?: string }>) => {
          if (data.error || !data.geometry) fail("Diagram routing could not finish.");
          else resolve(data.geometry);
        },
      );
      worker.postMessage(input);
    });
    const timer = setTimeout(cancel, 15_000);
    const entry: Job = {
      promise: promise
        .then((geometry) => {
          cache.set(key, geometry);
          if (cache.size > 16) cache.delete(cache.keys().next().value as string);
          return geometry;
        })
        .finally(() => {
          clearTimeout(timer);
          worker.terminate();
          if (running.get(key) === entry) running.delete(key);
        }),
      cancel,
      users: 0,
    };
    job = entry;
    running.set(key, entry);
  }
  const active = job;
  active.users++;
  return new Promise<StudioGeometry>((resolve, reject) => {
    let finished = false;
    const finish = () => {
      if (finished) return false;
      finished = true;
      signal.removeEventListener("abort", abort);
      if (--active.users === 0 && running.get(key) === active) {
        running.delete(key);
        active.cancel();
      }
      return true;
    };
    const abort = () => {
      if (finish()) reject(signal.reason);
    };
    signal.addEventListener("abort", abort, { once: true });
    active.promise.then(
      (geometry) => {
        if (finish()) resolve(geometry);
      },
      (error: unknown) => {
        if (finish()) reject(error);
      },
    );
  });
}
